$(function(){

    // models
    var Job = Backbone.Model.extend({
        initialize: function() {
            this.set("title_sanitized", this.get("name").replace(' ', '-').toLowerCase());
        }
    });
    var Person = Backbone.Model.extend();
    var Event = Backbone.Model.extend();

    // collections
    var Jobs = Backbone.Collection.extend({
        url: "json/jobs.json",
        model: Job,
    });

    var People = Backbone.Collection.extend({
        url: "json/people.json",
        model: Person,
    });

    var Events = Backbone.Collection.extend({
        url: "json/events.json",
        model: Event,
        comparator: function(e) {
            return e.get('time');
        }
    });

    var requirements_list = {
        "r": {
            "text": "Required",
            "color": "red",
            "description": "Attendance is mandatory"
        },
        "o": {
            "text": "Optional",
            "color": "yellow",
            "description": "Attendance is optional"
        },
        "rc": {
            "text": "Possible",
            "color": "orange",
            "description": "May not need to stay for content"
        }
    };
    var all_events = new Events;
    var all_jobs = new Jobs;
    var all_people = new People;

    // views

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
    var JobView = DetailView.extend({
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
    var PersonView = DetailView.extend({
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
            this.$el.html(this.template(json));
            return this;
        }
    });
    var EventView = DetailView.extend({
        template: _.template($('#detail-event-template').html()),
    });

    var AllEventsView = Backbone.View.extend({
        template: _.template($('#all-events-template').html()),
        events: {},
        initialize: function() {
            this.listenTo(all_events, 'all', this.render());
        },
        render: function() {
            var days = _.groupBy(all_events.toJSON(), function(e) {
                return new Date(e.time.start).getDate();
            });
            var json = { 'events': days };
            console.log(json);
            this.$el.html(this.template(json));
            return this;
        }
    })

    var AppView = Backbone.View.extend({
        el: $("#main"),
        events: {
            "click .my_details_button": "get_my_details",
            "click #show_events": "show_events",
        },
        initialize: function() {
            this.listenTo(all_events, 'add', this.addEvent);
            this.listenTo(all_jobs, 'add', this.addJob);
            this.listenTo(all_people, 'add', this.addPerson);
            this.listenTo(all_events, 'reset', this.addAllEvents);
            this.listenTo(all_jobs, 'reset', this.addAllJobs);
            this.listenTo(all_people, 'reset', this.addAllPeople);

            this.render();
        },
        render: function() {
            this.$('#content').text("Nothing to see here");
            return this;
        },
        addEvent: function(ev) {
            var view = new ShortEventView({model: ev});
            this.$('#all_events').append(view.render().el);
        },
        addJob: function(ev) {
            var view = new ShortJobView({model: ev});
            this.$('#all_jobs').append(view.render().el);
        },
        addPerson: function(ev) {
            var view = new ShortPersonView({model: ev});
            this.$('#all_people').append(view.render().el);
        },
        addAllEvents: function() {
            this.$('#all_events').empty();
            all_events.each(this.addEvent, this);
        },
        addAllJobs: function() {
            this.$('#all_jobs').empty();
            all_jobs.each(this.addJob, this);
        },
        addAllPeople: function() {
            this.$('#all_people').empty();
            all_people.each(this.addPerson, this);
        },
        show_events: function() {
            app_router.navigate("event", {trigger: true});
        },
        get_my_details: function() {
            return false;
        }
    });

    // App!
    var App = new AppView;

    var Routespace = Backbone.Router.extend({
        initialize: function() {
            this.currentView = null;
        },
        routes: {
            "event":        "all_events",
            "person/:username":    "person",
            "event/:id":    "event_route",
            "job/:title":   "job"
        },
        all_events: function() {
            this.swapView(new AllEventsView());
        },
        event_route: function(id) {
            // do stuff...
            var m = all_events.findWhere({'id': parseInt(id)});
            if (m) {
                this.swapView(new EventView({
                    model: m
                }));
            } else {
                console.log("the event with id " + id + " was not found");
            }
        },
        person: function(username) {
            // do stuff...
            var m = all_people.findWhere({'username': username});
            if (m) {
                this.swapView(new PersonView({
                    model: m
                }));
            } else {
                console.log("the username " + username + " was not found");
            }
        },
        job: function(title) {
            // do stuff...
            var m = all_jobs.findWhere({'title_sanitized': title});
            if (m) {
                this.swapView(new JobView({
                    model: m
                }));
            } else {
                console.log("the job " + title + " was not found");
            }
        },
        swapView: function(view) {
            if (this.currentView) {
                this.currentView.remove();
            }
            this.currentView = view;
            $('#content').html(this.currentView.render().el);
        }
    });

    var app_router = new Routespace;

    // get all resources before anything starts
    var e_req = all_events.fetch();
    var j_req = all_jobs.fetch();
    var p_req = all_people.fetch();
    $.when(e_req, j_req, p_req).done(function() {
        Backbone.history.start();
    });

});
