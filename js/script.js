$(function(){

    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };

    Backbone.emulateJSON = true;

    var options = {
        filetype: "csv", // "csv" or "json"
    }

    /*----------------------*
     *   Helper Functions   |
     *----------------------*/
    var utils = {
        groupByDay: function(collection) {
            return _.groupBy(collection, function(e) {
                return e.time.start.isoWeekday();
            });
        },
    }

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
    var AppCollection;
    switch (options.filetype) {
        case "csv":
            AppCollection = Backbone.Collection.extend({
                sync: function(method, model, options) {
                    var type = methodMap[method];

                    // Default options, unless specified.
                    _.defaults(options || (options = {}), {
                        emulateHTTP: Backbone.emulateHTTP,
                        emulateJSON: Backbone.emulateJSON
                    });

                    // Default JSON-request options.
                    var params = {type: type};

                    // Ensure that we have a URL.
                    if (!options.url) {
                        params.url = _.result(model, 'url') || urlError();
                    }

                    // Don't process data on a non-GET request.
                    if (params.type !== 'GET' && !options.emulateJSON) {
                        params.processData = false;
                    }

                    // Make the request, allowing the user to override any Ajax options.
                    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
                    model.trigger('request', model, xhr, options);
                    return xhr;
                },
                parse: function(response) {
                    var json = [];
                    var text = response.replace(',,', ', ,', "gm");
                    var lines = text.split('\n');
                    var keys = lines.shift().split(',');
                    _.each(lines, function(line) {
                        var line_array = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
                        if (line_array && line_array.length > 1) {
                            var object = {};
                            _.each(keys, function(key, i) {
                                // the key indicates that it's supposed to be nested
                                if (key.indexOf('--') > 0) {
                                    console.log(line_array[i]);
                                    if (line_array[i] && line_array[i] !== "" && line_array[i] !== " ") {
                                        var key_p = key.split('--');
                                        console.log(key_p[1]);
                                        object[key_p[0]] = object[key_p[0]] || [];
                                        object[key_p[0]].push({
                                            "id": +key_p[1],
                                            "requirement": line_array[i]
                                        });
                                    }
                                } else if (key.indexOf('-') > 0) {
                                    // split the key into it's levels
                                    var key_p = key.split('-');
                                    // find how deep it goes
                                    var depth = key_p.length - 1;
                                    // save a reference to the level we're on.
                                    var level_on = object;
                                    // convert date to a moment object
                                    var val = line_array[i];
                                    if (key.indexOf("time") < 1) {
                                        val = new moment(val);
                                    }
                                    // loop through levels
                                    _.each(key_p, function(key_l, key_i) {
                                        // if we're at the bottom, set it to the csv value
                                        if (key_i == depth) {
                                            level_on = level_on[key_l] = val;
                                        } else { // otherwise, move down the tree
                                            level_on = level_on[key_l] = level_on[key_l] || {};
                                        }
                                    });
                                } else {
                                    // remove surrounding quotes from strings with them
                                    if (new RegExp(/(".*?")/g).test(line_array[i])) {
                                        line_array[i] = line_array[i].substring(1, line_array[i].length - 1);
                                    }
                                    var val = line_array[i];
                                    // special cases
                                    switch (key) {
                                        case "id": // convert ids to numbers
                                            val = +val;
                                            break;
                                        case "events": // parse events (sytax: "id:code, id:code")
                                            if (val) {
                                                // split into array by comma
                                                var events = val.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
                                                // convert to array of objects with id and requirement
                                                events = _.map(events, function(e) {
                                                    var ret = {};
                                                    var event_data = e.split(":");
                                                    ret['id'] = +event_data[0];
                                                    ret['requirement'] = event_data[1];
                                                    return ret;
                                                });
                                            }
                                            // reject values with null requirements (can happen if there's an extra comma at the end of the events string)
                                            events = _.reject(events, function(e) {
                                                return !(e.requirement && e.requirement.replace(/^\s\s*/, '').replace(/\s\s*$/, ''));
                                            });
                                            val = events;
                                            break;
                                        case "people":
                                            // create array of people
                                            val = val.split(' ');
                                            val = _.reject(val, function(e) {
                                                return !(e.replace(/^\s\s*/, '').replace(/\s\s*$/, ''));
                                            });
                                            break;
                                        default:
                                            ;
                                    }
                                    object[key] = val;
                                }
                            });
                            json.push(object);
                        }
                    });
                    console.log(json);
                    return json;
                }
            });
            break;
        case "json":
            AppCollection = Backbone.Collection.extend({
                parse: function(response) {
                    _.map(response, function(thing) {
                        if (thing.time) {
                            thing.time.start = new moment(thing.time.start);
                            thing.time.end = new moment(thing.time.end);
                        }
                        return thing;
                    });
                    return response;
                }
            });
            break;
        default:
            alert("You've specified " + options.filetype + " as your filetype. Please change it to csv or json.");
            break;
    }
    var Jobs = AppCollection.extend({
        url: options.filetype + "/jobs." + options.filetype,
        model: Job,
        comparator: function(e) {
            if (e.get('title_sanitized') == "all-staff") {
                return "zzzzall-staff";
            }
            return e.get('title_sanitized');
        },
    });
    var People = AppCollection.extend({
        url: options.filetype + "/people." + options.filetype,
        model: Person,
        comparator: function(e) {
            return e.get('name');
        },
    });
    var Events = AppCollection.extend({
        url: options.filetype + "/events." + options.filetype,
        model: Event,
        comparator: function(e) {
            return e.get('time').start.valueOf();
        },
    });

    /*-----------*
     |   Views   |
     *-----------*/
    // container view
    var AppView = Backbone.View.extend({
        el: $("body"),
        events: {
            "click #show_events": "show_events",
            "click #show_overview": "show_overview",
            "click #to_nav": "scroll_down",
            "click #to_top": "scroll_up",
        },
        initialize: function() {
            this.listenTo(all_jobs, 'add', this.addJob);
            this.listenTo(all_people, 'add', this.addPerson);
            this.listenTo(all_jobs, 'reset', this.addAllJobs);
            this.listenTo(all_people, 'reset', this.addAllPeople);

            // add everything to the sidebar and render this view,
            // it's not controlled by the router so it has to render itself
            this.addAllPeople().addAllJobs().render();
        },
        render: function() {
            this.$('#content').text('Nothing has loaded yet...');
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
        },
        scroll_down: function() {
            // scroll to the sidebar
            var target = this.$('#side').position().top - 10;
            var duration = (target - this.$el.scrollTop()) * 0.3;
            this.$el.animate({
                scrollTop: target
            }, duration);
        },
        scroll_up: function() {
            var duration = this.$el.scrollTop() * 0.4;
            this.$el.animate({
                scrollTop: 0
            }, duration);
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
            // get the full event data for each event
            _.each(events, function(e) {
                full_e = all_events.findWhere({'id': e.id});
                if (full_e) {
                    var single_e = full_e.toJSON();
                    // get the full requirement data
                    single_e['req'] = requirements_list[e.requirement];
                    // compute the height
                    var height = (single_e.time.end - single_e.time.start) / (1000 * 60 * 15); // min-height in em's, 1 em to 15 minutes
                    single_e['height'] = height;
                    this.e_data.push(single_e);
                } else {
                    console.log("Event " + e.id + " was not found.");
                }
            }, this);
            // group by day
            this.e_data = utils.groupByDay(this.e_data);
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
            // pass event data to the template as well as model data
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
            this.events_ = this.model.get('events') || [];
            // for their job(s)...
            _.each(this.jobs, function(j) {
                // look at each event
                _.each(j.get('events'), function(j_e) {
                    // add the event to the person's list if it's not there (person event takes precidence)
                    if (!_.find(this.events_, function(p_e) {
                        return p_e.id == j_e.id;
                    })) {
                        this.events_.push(j_e);
                    }
                }, this);
            }, this);

            // get events for this job
            this.get_e_data(this.events_);

            // calculate total and required hours
            this.total_hours = new moment.duration(0);
            this.required_hours = new moment.duration(0);
            _.each(this.e_data, function(d) {
                _.each(d, function(e) {
                    var duration = new moment(e.time.end) - new moment(e.time.start);
                    this.total_hours.add(duration);
                    if (e.req.label == "danger") {
                        this.required_hours.add(duration);
                    }
                }, this);
            }, this);
        },
        render: function() {
            var json = this.model.toJSON();
            // pass event and job data into this template as well as model data
            json['e_data'] = this.e_data;
            json['total_hours'] = this.total_hours;
            json['required_hours'] = this.required_hours;
            json['jobs'] = _.without(this.jobs.map(function(j) {
                return j.get('title_sanitized');
            }), 'all-staff');
            this.$el.html(this.template(json));
            return this;
        }
    });
    var EventView = DetailView.extend({
        template: _.template($('#detail-event-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);

            this.people = new People(all_people.toJSON()); // .clone() still holds references to the original models
            all_people.each(function(p) {
                var p_e = _.findWhere(p.get('events'), {'id': this.model.id})
                if (p_e) {
                    p_e = p_e.requirement;
                    this.people.get(p.id).set('requirement', p_e);
                }
            }, this);
            all_jobs.each(function(j) {
                var j_e = _.findWhere(j.get('events'), {'id': this.model.id})
                if (j_e) {
                    j_e = j_e.requirement;
                    _.each(j.get('people'), function(p) {
                        var this_p = this.people.findWhere({'username': p});
                        if (!this_p.get('requirement')) {
                            this_p.set('requirement', j_e);
                        }
                    }, this);
                }
            }, this);
            this.people = this.people.filter(function(p) {
                return p.get('requirement');
            });
            this.people = _.map(this.people, function(p) {
                return p.toJSON();
            });
        },
        render: function() {
            var json = this.model.toJSON();
            json['people'] = this.people;
            this.$el.html(this.template(json));
            return this;
        },
    });

    // all of a type views (broad)
    var AllTypeView = Backbone.View.extend({
        template: _.template($('#all-template').html()),
        initialize: function() {
            this.listenTo(this.collection, 'all', this.render());
        },
        render: function() {
            this.$el.html(this.template({ 'things': this.collection.toJSON() }));
            return this;
        }
    });
    var AllEventsView = AllTypeView.extend({
        template: _.template($('#all-events-template').html()),
        render: function() {
            var days = utils.groupByDay(this.collection.toJSON());
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
        events: {
            'click .close':         'hide_column',
            'click .u_hidden .open':'show_column',
            'change #toggle-jobs':     'toggle_jobs',
            'change #toggle-people':   'toggle_people',
        },
        generate_data: function() {
            // NOTE: if this data ever is dynamically changed, a flag will
            // need to be set to regenerate data when all_* changes.
            if (!this.data) {
                this.data = {};
                // get all event data
                this.data['events'] = all_events.toJSON();
                // for each event...
                _.each(this.data.events, function(e, e_i) {
                    // put event data for each person in it...
                    e_p = all_people.map(function(p) {
                        // get only data for this event
                        var test = _.findWhere(p.toJSON().events, { id: e_i });
                        if (test) {
                            return test.requirement;
                        } else {
                            return '';
                        }
                    });
                    e['p_data'] = e_p;
                    // for each person get their job information as well
                    _.each(e.p_data, function(p, p_i, p_list) {
                        // get the person's username
                        var username = all_people.at(p_i).get('username');

                        // from the collection of jobs, find any for this person
                        var jobs = _.filter(all_jobs.models, function(j) {
                            var j_people = j.get('people');
                            return _.contains(j.get('people'), username);
                        }, this);

                        // for each job this person is in...
                        _.each(jobs, function(j) {
                            // reduce the job to just the event we need to know about if it's there
                            j = _.findWhere(j.toJSON().events, {id: e_i});
                            if (j) {
                                if (p == '') {
                                    p_list[p_i] = j.requirement;
                                }
                            }
                        }, this);
                    });

                    // put event data for each job in the event
                    e_j = all_jobs.map(function(j) {
                        // get only data for this event
                        var test = _.findWhere(j.toJSON().events, { id: e_i });
                        if (test) {
                            return test.requirement;
                        } else {
                            return '';
                        }
                    });
                    e['j_data'] = e_j;
                });
                // group events by day
                this.data.events = utils.groupByDay(this.data.events);
                // get usernames and titles
                this.data['usernames'] = all_people.pluck('username');
                this.data['titles'] = all_jobs.pluck('title_sanitized');
            }
            return this.data;
        },
        render: function() {
            this.$el.html(this.template(this.generate_data()));
            return this;
        },
        hide_column: function(e) {
            // get the clicked element
            var $element = $(e.currentTarget);
            // this class needs to be hidden
            var col_class = $element.parent().parent().attr('class').replace('job', '').replace('person', '').replace(/^\s\s*/, '').replace(/\s\s*$/, '');

            // hide any cell with the (column designating) class
            this.$('#overview .' + col_class).addClass('hidden');
            // show the 'show' li
            this.$('.u_hidden .' + col_class).removeClass('hidden');

            return this.check_hidden();
        },
        show_column: function(e) {
            // see the comments for hide_column. this does the opposite
            e.preventDefault();
            var $element = $(e.currentTarget);
            var col_class = $element.parent().attr('class').replace('job', '').replace('person', '').replace(/^\s\s*/, '').replace(/\s\s*$/, '');

            this.$('#overview .' + col_class).removeClass('hidden');
            this.$('.u_hidden .' + col_class).addClass('hidden');

            return this.check_hidden();
        },
        toggle: function(e, c) {
            var $element = $(e.currentTarget);

            // when a toggle is clicked, it will show all or hide all, based on if it's checked or not
            if ($element.is(":checked")) {
                this.$('#overview .' + c).removeClass('hidden');
                this.$('.u_hidden .' + c).addClass('hidden');
            } else {
                this.$('#overview .' + c).addClass('hidden');
                this.$('.u_hidden .' + c).removeClass('hidden');
            }
            return this.check_hidden();
        },
        toggle_jobs: function(e) {
            this.toggle(e, 'job');
        },
        toggle_people: function(e) {
            this.toggle(e, 'person');
        },
        check_hidden: function() {
            // get the element
            var $u_hidden = this.$('.u_hidden');
            // show it
            $u_hidden.removeClass('hidden');
            // if all of it's children are hidden (except the first), hide it
            if ($u_hidden.find('li').length == $u_hidden.find('li.hidden').length + 1) {
                $u_hidden.addClass('hidden');
            }
            return this;
        }
    });

    // empty state - essentially a 404
    var EmptyState = Backbone.View.extend({
        render: function() {
            data = location.hash.split('/');
            if (data.length == 2) {
                // this can happen if a user, job, or event isn't found.
                // It'll direct to the main page for the 'type' it thinks you're looking for.
                this.$el.html("<h3>Can't find the <a href='" + data[0] + "'>" + data[0] + "</a> " + data[1].replace('-', ' ') + ".</h3>");
            } else {
                this.$el.html("<h3>Only emptiness here</h3>");
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
            "job/:title/":      "remove_slash",
            "":                 "index",
            "*anything":        "empty",
        },
        index: function() {
            this.navigate('job', {trigger: true});
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
            // if a view exists, remove it from the dom and stop event handlers
            if (this.currentView) {
                this.currentView.remove();
            }
            this.currentView = view;
            // put the new view's content into the #content element after it's rendered
            $('#content').html(this.currentView.render().el);

            // scroll to the top of the page
            var duration = $('body').scrollTop() * 0.6;
            $('body').animate({
                scrollTop: 0
            }, duration);

            // any new elements need their tooltips started
            $('.tooltip-trigger').tooltip();
        },
        swapDetailView: function(collection, view, attrs) {
            var m = collection.findWhere(attrs);
            if (m) {
                this.swapView(new view({ model: m }));
            } else {
                this.swapView(new EmptyState({'view': view}));
            }
        },
        empty: function() {
            this.swapView(new EmptyState());
        }
    });

    /*------------------------------------------*
     |   Global Vars, Collections, and Router   |
     *------------------------------------------*/
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
    // identify scrolling as a user action and stops the animation
    $(document).on("scroll mousedown DOMMouseScroll mousewheel keyup", function(e){
        if ( e.which > 0 || e.type === "mousedown" || e.type === "mousewheel") {
             $(document).stop();
        }
    });

});
