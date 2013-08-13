$(function(){

    /*------------*
     |   Models   |
     *------------*/
    var Job = Backbone.Model.extend({
        initialize: function() {
            this.set("title_sanitized", this.get("name").replace(' ', '-').toLowerCase());
        }
    });
    var Person = Backbone.Model.extend();
    var Event = Backbone.Model.extend();

    /*-----------------*
     |   Collections   |
     *-----------------*/
    var Jobs = Backbone.Collection.extend({
        url: "json/jobs.json",
        model: Job,
        comparator: function(e) {
            return e.get('title_sanitized');
        }
    });
    var People = Backbone.Collection.extend({
        url: "json/people.json",
        model: Person,
        comparator: function(e) {
            return e.get('name');
        }
    });
    var Events = Backbone.Collection.extend({
        url: "json/events.json",
        model: Event,
        comparator: function(e) {
            return e.get('time');
        }
    });

    /*-----------*
     |   Views   |
     *-----------*/
    // container view
    var AppView = Backbone.View.extend({
        el: $("#main"),
        events: {
            "click #show_events": "show_events",
            "click #show_overview": "show_overview"
        },
        initialize: function() {
            this.listenTo(all_jobs, 'add', this.addJob);
            this.listenTo(all_people, 'add', this.addPerson);
            this.listenTo(all_jobs, 'reset', this.addAllJobs);
            this.listenTo(all_people, 'reset', this.addAllPeople);

            this.addAllPeople().addAllJobs().render();
        },
        render: function() {
            this.$('#content').text("Nothing to see here");
            return this;
        },
        addJob: function(ev) {
            var view = new ShortJobView({model: ev});
            this.$('#all_jobs').append(view.render().el);
        },
        addPerson: function(ev) {
            var view = new ShortPersonView({model: ev});
            this.$('#all_people').append(view.render().el);
        },
        addAllJobs: function() {
            this.$('#all_jobs').empty();
            all_jobs.each(this.addJob, this);
            return this;
        },
        addAllPeople: function() {
            this.$('#all_people').empty();
            all_people.each(this.addPerson, this);
            return this;
        },
        show_events: function() {
            appRouter.navigate("event", {trigger: true});
        },
        show_overview: function() {
            appRouter.navigate("overview", {trigger: true});
        }
    });

    // small views
    var ListItemView = Backbone.View.extend({
        tagName: "li",
        template: _.template($('#list-item-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);
        },
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        }
    });
    var ShortJobView = ListItemView.extend({
        template: _.template($('#short-job-template').html()),
    });
    var ShortPersonView = ListItemView.extend({
        template: _.template($('#short-person-template').html()),
    });
    var ShortEventView = ListItemView.extend({
        template: _.template($('#short-event-template').html()),
    });

    // detail views (medium)
    var DetailView = Backbone.View.extend({
        template: _.template($('#detail-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);
        },
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        },
    });
    var HasEventDetailView = DetailView.extend({
        get_e_data: function(events) {
            this.e_data = [];
            _.each(events, function(e) {
                full_e = all_events.findWhere({'id': e.id});
                if (full_e) {
                    var single_e = full_e.toJSON();
                    single_e['req'] = requirements_list[e.requirement];
                    var height = (new Date(single_e.time.end).getTime() - new Date(single_e.time.start).getTime()) / (1000 * 60 * 15); // min-height in em's, 1 em to 15 minutes
                    single_e['height'] = height;
                    this.e_data.push(single_e);
                }
            }, this);
            this.e_data = _.groupBy(_.sortBy(this.e_data, function(e) {
                return e.time.start;
            }), function(e) {
                return new Date(e.time.start).getDate();
            });
        }
    });
    var JobView = HasEventDetailView.extend({
        template: _.template($('#detail-job-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);

            // get events for this job
            this.get_e_data(this.model.get('events'));
        },
        render: function() {
            var json = this.model.toJSON();
            json['e_data'] = this.e_data;
            this.$el.html(this.template(json));
            return this;
        }
    });
    var PersonView = HasEventDetailView.extend({
        template: _.template($('#detail-person-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);

            // from the collection of jobs, find any for this person
            this.jobs = _.filter(all_jobs.models, function(j) {
                var j_people = j.get('people');
                return _.contains(j.get('people'), this.model.get('username'));
            }, this);

            // get events for this person
            this.events_ = this.model.get('events');
            // for their job(s)...
            _.each(this.jobs, function(j) {
                // look at each event
                _.each(j.get('events'), function(j_e) {
                    // add the event to the person's list if it's not their (person event takes precidence)
                    if (!_.find(this.events_, function(p_e) {
                        return p_e.id == j_e.id;
                    })) {
                        this.events_.push(j_e);
                    }
                }, this);
            }, this);

            this.get_e_data(this.events_);
        },
        render: function() {
            var json = this.model.toJSON();
            json['e_data'] = this.e_data;
            json['jobs'] = _.without(this.jobs.map(function(j) {
                return j.get('title_sanitized');
            }), 'all-staff');
            this.$el.html(this.template(json));
            return this;
        }
    });
    var EventView = DetailView.extend({
        template: _.template($('#detail-event-template').html()),
    });

    // all of a type views (broad)
    var AllTypeView = Backbone.View.extend({
        template: _.template($('#all-template').html()),
        initialize: function() {
            this.listenTo(this.collection, 'all', this.render());
        },
        render: function() {
            // console.log(this.collection.toJSON());
            this.$el.html(this.template({ 'things': this.collection.toJSON() }));
            return this;
        }
    });
    var AllEventsView = AllTypeView.extend({
        template: _.template($('#all-events-template').html()),
        render: function() {
            var days = _.groupBy(this.collection.toJSON(), function(e) {
                return new Date(e.time.start).getDate();
            });
            var json = { 'events': days };
            this.$el.html(this.template(json));
            return this;
        }
    });
    var AllPeopleView = AllTypeView.extend({
        template: _.template($('#all-people-template').html()),
    });
    var AllJobsView = AllTypeView.extend({
        template: _.template($('#all-jobs-template').html()),
    });

    // overview (large)
    var OverView = Backbone.View.extend({ // overview of all data (all people, their jobs, and all events)
        template: _.template($('#overview-template').html()),
        initialize: function() {
            this.listenTo(all_events, 'all', this.render());
            this.listenTo(all_people, 'all', this.render());
            this.listenTo(all_jobs, 'all', this.render());
        },
        render: function() {
            this.$el.html(this.template({'nope': 'fail'}));
            return this;
        }
    });

    // empty state (none of a type found)
    var EmptyState = Backbone.View.extend({
        render: function() {
            data = location.hash.split('/');
            if (data.length = 2) {
                this.$el.html("<h3>Can't find the <a href='" + data[0] + "'>" + data[0] + "</a> " + data[1].replace('-', ' ') + ".</h3>");
            } else {
                this.$el.html("<h3>Only emptyness here</h3>");
            }
            return this;
        }
    });

    /*------------*
     |   Router   |
     *------------*/
    var AppRouter = Backbone.Router.extend({
        initialize: function() {
            this.currentView = null;
        },
        routes: {
            "overview":         "overview",
            "overview/":        "remove_slash",
            "event":            "all_events",
            "event/":           "remove_slash",
            "person":           "all_people",
            "person/":          "remove_slash",
            "job":              "all_jobs",
            "job/":             "remove_slash",
            "person/:username": "one_person",
            "person/:username/":"remove_slash",
            "event/:id":        "one_event",
            "event/:id/":       "remove_slash",
            "job/:title":       "one_job",
            "job/:title/":      "remove_slash"
        },
        overview: function() {
            this.swapView(new OverView());
        },
        all_events: function() {
            this.swapView(new AllEventsView({collection: all_events}));
        },
        all_people: function() {
            this.swapView(new AllPeopleView({collection: all_people}));
        },
        all_jobs: function() {
            this.swapView(new AllJobsView({collection: all_jobs}));
        },
        one_event: function(id) {
            this.swapDetailView(all_events, EventView, {'id': parseInt(id)})
        },
        one_person: function(username) {
            this.swapDetailView(all_people, PersonView, {'username': username})
        },
        one_job: function(title) {
            this.swapDetailView(all_jobs, JobView, {'title_sanitized': title});
        },
        remove_slash: function() {
            this.navigate(location.hash.slice(0, -1), {trigger: true});
        },
        swapView: function(view) {
            if (this.currentView) {
                this.currentView.remove();
            }
            this.currentView = view;
            $('#content').html(this.currentView.render().el);
            $('.tooltip-trigger').tooltip();
        },
        swapDetailView: function(collection, view, attrs) {
            var m = collection.findWhere(attrs);
            if (m) {
                this.swapView(new view({
                    model: m
                }));
            } else {
                this.swapView(new EmptyState({'view': view}));
            }
        }
    });

    /*------------------------------------------*
     |   Global Vars, Collections, and Router   |
     *------------------------------------------*/
    var requirements_list = {
        "r": {
            "text": "Required",
            "label": "danger",
            "description": "Attendance is mandatory"
        },
        "o": {
            "text": "Optional",
            "label": "warning",
            "description": "Attendance is optional"
        },
        "s": {
            "text": "Partial",
            "label": "info",
            "description": "Stay as long as content is relavent"
        },
        "rc": {
            "text": "Possible",
            "label": "info",
            "description": "May not need to stay for content"
        }
    };
    var all_events = new Events;
    var all_jobs = new Jobs;
    var all_people = new People;
    var appRouter = new AppRouter;

    /*--------------------------*
     |   Start things moving!   |
     *--------------------------*/
    // get all resources before anything starts
    var e_req = all_events.fetch();
    var j_req = all_jobs.fetch();
    var p_req = all_people.fetch();
    $.when(e_req, j_req, p_req).done(function() {
        // App!
        var App = new AppView;

        $('.tooltip-trigger').tooltip();

        // Start router and navigation
        Backbone.history.start();
    });

});
