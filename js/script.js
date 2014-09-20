$(function(){
    moment.parseTwoDigitYear = function(input) {
        return parseInt(input) + 2000;
    }

    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };

    /*----------------------*
     *   Helper Functions   |
     *----------------------*/
    var utils = {
        groupByDay: function(collection) {
            return _.groupBy(collection, function(e) {
                return e.time.start.dayOfYear();
            });
        },
    }

    /*------------*
     |   Models   |
     *------------*/
    var HasEventsModel = Backbone.Model.extend({
        check_events: function(model) {
            if (_.some(this.get('events'), function(e) {
                return e.id == model.get('id');
            })) {
                this.save('events', _.reject(this.get('events'), function(e) {
                    return e.id == model.get('id');
                }));
            };
        },
    });
    var Job = HasEventsModel.extend({
        initialize: function() {
            this.set("title_sanitized", this.get("name").replace(' ', '-').toLowerCase());
            this.listenTo(all_people, 'remove', this.check_people);
            this.listenTo(all_events, 'remove', this.check_events);
        },
        check_people: function(model) {
            if (_.contains(this.get('people'), model.get('username'))) {
                this.save('people', _.without(this.get('people'), model.get('username')));
            }
        },
    });
    var Person = HasEventsModel.extend({
        initialize: function() {
            this.listenTo(all_events, 'remove', this.check_events);
        },
    });
    var Event = Backbone.Model.extend();

    /*-----------------*
     |   Collections   |
     *-----------------*/
    var AppCollection = Backbone.Collection.extend({
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
    var Jobs = AppCollection.extend({
        url: "json" + "/jobs." + "json",
        model: Job,
        comparator: function(e) {
            if (e.get('title_sanitized') == "all-staff") {
                return "zzzzall-staff";
            }
            return e.get('title_sanitized');
        },
    });
    var People = AppCollection.extend({
        url: "json" + "/people." + "json",
        model: Person,
        comparator: function(e) {
            return e.get('name');
        },
    });
    var Events = AppCollection.extend({
        url: "json" + "/events." + "json",
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
            "click .to_top": "scroll_up",
            "click #person-mobile-link": "scroll_person",
            "click #job-mobile-link": "scroll_job",
            "click #other-mobile-link": "scroll_other",
            "click #show_edit": "show_edit",
        },
        initialize: function() {
            this.listenTo(all_jobs, 'add', this.addJob);
            this.listenTo(all_people, 'add', this.addPerson);

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
        scrollTo: function(e, target) {
            e.preventDefault();
            var target = target.offset().top - 10;
            var duration = (target - this.$el.scrollTop()) * 0.3;
            this.$el.animate({
                scrollTop: target
            }, duration);
        },
        scroll_down: function(e) {
            // scroll to the sidebar
            this.scrollTo(e, $('#side'));
        },
        scroll_up: function() {
            var duration = this.$el.scrollTop() * 0.4;
            this.$el.animate({
                scrollTop: 0
            }, duration);
        },
        scroll_person: function(e) {
            this.scrollTo(e, $('#all_people_label'));
        },
        scroll_job: function(e) {
            this.scrollTo(e, $('#all_jobs_label'));
        },
        scroll_other: function(e) {
            this.scrollTo(e, $('#show_events'));
        },
        show_edit: function() {
            appRouter.navigate("edit", {trigger: true});
        },
    });

    // small views
    var ListItemView = Backbone.View.extend({
        tagName: "li",
        template: _.template($('#list-item-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'remove', this.remove);
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

    // detail views (medium)
    var DetailView = Backbone.View.extend({
        template: _.template($('#detail-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'remove', this.remove);
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
                    console.warn("Event " + e.id + " was not found.");
                }
            }, this);
            // group by day
            this.e_data = _.sortBy(this.e_data, function(e) {
                return e.time.start.valueOf();
            });
            this.e_data = utils.groupByDay(this.e_data);
        }
    });
    var JobView = HasEventDetailView.extend({
        template: _.template($('#detail-job-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'remove', this.remove);

            var this_events = this.model.get('events');
            var event_data = _.union(this_events, _.filter(all_jobs.findWhere({title_sanitized: 'all-staff'}).get('events'), function(e) {
                return !_.contains(_.pluck(this_events, 'id'), e.id);
            }));

            // get events for this job
            this.get_e_data(event_data);
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
            this.listenTo(this.model, 'remove', this.remove);

            // from the collection of jobs, find any for this person
            this.jobs = _.filter(all_jobs.models, function(j) {
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
            this.listenTo(this.model, 'remove', this.remove);

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
                        if (this_p) {
                            if (!this_p.get('requirement')) {
                                this_p.set('requirement', j_e);
                            }
                        } else {
                            console.warn("Couldn't find person " + p);
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
                var all_staff_events = all_jobs.findWhere({'name': 'All Staff'}).get('events');
                // for each event...
                _.each(this.data.events, function(e, e_i) {
                    // put event data for each person in it...
                    e_p = all_people.map(function(p) {
                        // get only data for this event
                        var test = _.findWhere(p.toJSON().events, { id: e.id });
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
                        var jobs = all_jobs.filter(function(j) {
                            if (j.get('name') == "All Staff") {
                                return false;
                            } else {
                                return _.contains(j.get('people'), username);
                            }
                        }, this);

                        // for each job this person is in...
                        _.each(jobs, function(j) {
                            if (p == '') {
                                // reduce the job to just the event we need to know about if it's there
                                var j_event = _.findWhere(j.get('events'), {id: e.id });
                                if (j_event) {
                                    p_list[p_i] = j_event.requirement;
                                } else {
                                    var all_req = _.findWhere(all_staff_events, {id: e.id});
                                    if (all_req) {
                                        p_list[p_i] = all_req.requirement;
                                    }
                                }
                            }
                        }, this);
                    });

                    // put event data for each job in the event
                    e_j = all_jobs.map(function(j) {
                        // get only data for this event
                        var test = _.findWhere(j.toJSON().events, {id: e.id});
                        if (test) {
                            return test.requirement;
                        } else {
                            var all_req = _.findWhere(all_staff_events, {id: e.id});
                            if (all_req) {
                                return all_req.requirement;
                            } else {
                                return '';
                            }
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

    // edit view
    var HasChildrenView = Backbone.View.extend({
        spawn_child: function(view_type, model, target) {
            var new_child = new view_type({model: model, parent: this.model}).render();
            new_child.$el.appendTo(this.$(target));
            this.children = this.children || [];
            this.children.push(new_child);
            return new_child;
        },
        remove: function() {
            // OVERRIDDEN TO REMOVE CHILDREN
            _.each(this.children, function(child) {
                child.remove();
            });
            return Backbone.View.prototype.remove.call(this);
        }
    });
    var EditView = HasChildrenView.extend({
        id: "editview",
        template: _.template($('#editview-template').html()),
        events: {
            'click .selectable': 'toggle_delete',
            'click .minieventedit .selectable': 'toggle_change',
            'click #bulk-delete': 'bulk_delete',
            'click #bulk-change': 'bulk_change',
            'click #generate-json': 'generate_json',
            'click #new-event': 'new_event',
            'click #new-job': 'new_job',
            'click #new-person': 'new_person',
        },
        render: function() {
            this.$el.html(this.template());
            all_events.each(function(e) {
                this.spawn_child(EventEditView, e, '#edit-col-events .contents');
            }, this);
            all_jobs.each(function(j) {
                this.spawn_child(JobEditView, j, '#edit-col-jobs .contents');
            }, this);
            all_people.each(function(p) {
                this.spawn_child(PersonEditView, p, '#edit-col-people .contents');
            }, this);
            return this;
        },
        toggle: function(button, target) {
            if (this.$(target).length > 0) {
                this.$(button).removeAttr('disabled');
            } else {
                this.$(button).attr('disabled', 'disabled');
            }
        },
        toggle_delete: function() {
            this.toggle('#bulk-delete', '.selectable.active');
        },
        toggle_change: function() {
            this.toggle('#bulk-change', '.minieventedit .selectable.active');
        },
        bulk_delete: function() {
            $('.selectable.active .close').click();
            this.toggle_delete();
        },
        bulk_change: function() {
            console.warn('not implemented');
        },
        json_replacer: function(key, value) {
            if (key == "filler" || key == "filler\r") {
                return undefined;
            } else if (typeof(value) == 'string') {
                return value.replace('\r', '');
            } else {
                return value;
            }
        },
        generate_json: function() {
            this.$('#json').show()
                .find('pre').html('<div class="form-group"><label>events.json</label><textarea class="form-control" rows="6">' + JSON.stringify(all_events.toJSON(), this.json_replacer) +
                                  '</textarea></div><div class="form-group"><label>jobs.json</label><textarea class="form-control" rows="6">' + JSON.stringify(all_jobs.toJSON(), this.json_replacer) +
                                  '</textarea></div><div class="form-group"><label>people.json</label><textarea class="form-control" rows="6">' + JSON.stringify(all_people.toJSON(), this.json_replacer) + '</textarea></div>');
        },
        new_x: function(model, attributes, collection, view, parent_container, e) {
            var new_model = new model(attributes);
            collection.create(new_model);
            var new_child = this.spawn_child(view, new_model, parent_container);
            App.scrollTo(e, new_child.$el);
        },
        new_event: function(e) {
            var attributes = {
                name: "New Event",
                time: {
                    start: new moment(),
                    end: new moment().add('h', 1)
                },
                place: "",
                description: ""
            };
            this.new_x(Event, attributes, all_events, EventEditView, '#edit-col-events', e);
        },
        new_job: function(e) {
            var name = window.prompt("What's this job called (singular, please)?") || "Incinerator";
            var attributes = {
                name: name,
                people: [],
                events: []
            };
            this.new_x(Job, attributes, all_jobs, JobEditView, '#edit-col-jobs', e);
        },
        new_person: function(e) {
            var name = window.prompt("What's this person's name?") || "Johnny Danger";
            var username = window.prompt("What's this person's username?") || "dangj";
            var attributes = {
                name: name,
                username: username,
                events: [],
            };
            this.new_x(Person, attributes, all_people, PersonEditView, '#edit-col-people', e);
        },
    });
    var ContentEditableView = HasChildrenView.extend({
        events: {
            'click .panel-title .close': 'remove_model',
            'mouseenter .panel-title .close': 'add_remove_warn',
            'mouseleave .panel-title .close': 'hide_remove_warn',
            'dblclick .editable': 'edit',
            'keypress  .editing': 'keypress',
            'blur .editing': 'done_editing',
        },
        initialize: function() {
            this.listenTo(this.model, 'remove', this.remove);
        },
        edit: function(e) {
            $('.editing').removeClass('editing').attr('contenteditable', 'false');
            $('.ui-draggable').draggable('enable');
            var that = this;
            this.$(e.target).addClass('editing').removeClass('text-muted').attr('contenteditable', 'true');
            if (this.$el.hasClass('ui-draggable')) {
                this.$el.draggable('disable');
            }
        },
        keypress: function(e) {
            if (e.keyCode == 13) {
                this.done_editing(e);
                e.preventDefault();
            }
        },
        save: function(e) {
            $edit_el = this.$(e.target);
            attr = $edit_el.data('attr');
            if (attr == 'start') {
                this.model.save('time', {
                    'start': new moment($edit_el.text()),
                    'end': this.model.get('time').end
                }, {patch: true});
            } else if (attr == 'end') {
                this.model.save('time', {
                    'start': this.model.get('time').start,
                    'end': new moment($edit_el.text())
                });
            } else {
                this.model.save(attr, $edit_el.text());
            }
            return $edit_el;
        },
        done_editing: function(e) {
            var target = this.save(e).removeClass('editing').attr('contenteditable', 'false');
            if (target.text() && target.text() == "") {
                target.addClass('text-muted');
            }
            if (this.$el.hasClass('ui-draggable')) {
                this.$el.draggable('enable');
            }
        },
        remove_model: function() {
            this.model.destroy();
            this.remove();
            return this;
        },
        add_remove_warn: function(e) {
            this.$el.addClass('panel-danger').removeClass('panel-default');
            return this;
        },
        hide_remove_warn: function(e) {
            this.$el.removeClass('panel-danger').addClass('panel-default');
            return this;
        },
    });
    var EventEditView = ContentEditableView.extend({
        className: "event-edit panel panel-default",
        template: _.template($('#event-editview-template').html()),
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            var that = this;
            this.$el.draggable({
                opacity: 0.7,
                helper: function(e) {
                    return $('<div class="drag-helper" data-id="' + that.model.get('id') + '"><span class="btn btn-default btn-sm">' + that.model.get('name') + '</span></div>');
                },
                cursor: "move",
                cursorAt: {
                    top: 10,
                    left: 10
                },
                scroll: true,
                scrollSensitivity: 100,
            });
            return this;
        }
    });
    var HasEventsChildrenView = ContentEditableView.extend({
        render_event: function(e) {
            var child = all_events.findWhere({'id': e.id});
            this.spawn_child(MiniEventEditView, child, '.job-events');
        },
        set_event_droppable: function() {
            var json = this.model.toJSON();
            this.$el.html(this.template(json));
            _.each(json.events, this.render_event, this);
            var that = this;
            this.$('.job-events').droppable({
                accept: '.event-edit',
                activeClass: 'drop-active',
                hoverClass: 'drop-hover',
                drop: function(e, ui) {
                    var events = that.model.get('events');
                    var event_id = ui.helper.data('id');
                    if (!_.some(events, function(e) {
                        return e.id == event_id;
                    })) {
                        var new_event = {
                            id: event_id,
                            requirement: "r"
                        };
                        events.push(new_event);
                        that.model.save('events', events);
                        that.render_event(new_event);
                        that.$('[data-id="' + event_id + '"]').addClass('btn-success');
                    } else {
                        that.$('[data-id="' + event_id + '"]').addClass('btn-success');
                        // provide visual feedback that a duplicate exists.
                    }
                    var animateNew = window.setTimeout(function() {
                        that.$('.btn-success').removeClass('btn-success').addClass('btn-default');
                    }, 200);
                }
            });
            return this;
        }
    });
    var JobEditView = HasEventsChildrenView.extend({
        className: "job-edit panel panel-default",
        template: _.template($('#job-editview-template').html()),
        render: function() {
            this.set_event_droppable();
            _.each(this.model.toJSON().people, this.render_person, this);
            var that = this;
            this.$('.job-people').droppable({
                accept: '.person-edit',
                activeClass: 'drop-active',
                hoverClass: 'drop-hover',
                drop: function(e, ui) {
                    var people = that.model.get('people');
                    var username = ui.helper.text();
                    if (!_.contains(people, username)) {
                        people.push(username);
                        that.model.save('people', people);
                        that.render_person(username);
                        that.$('[data-username="' + username + '"]').addClass('btn-success');
                    } else {
                        that.$('[data-username="' + username + '"]').addClass('btn-success');
                    }
                    var animateNew = window.setTimeout(function() {
                        that.$('.btn-success').removeClass('btn-success').addClass('btn-default');
                    }, 200);
                }
            });
            return this;
        },
        render_person: function(p) {
            var child = all_people.findWhere({'username': p});
            this.spawn_child(MiniPersonEditView, child, '.job-people');
        }
    });
    var PersonEditView = HasEventsChildrenView.extend({
        className: "person-edit panel panel-default",
        template: _.template($('#person-editview-template').html()),
        render: function() {
            this.set_event_droppable();
            var that = this;
            this.$el.draggable({
                opacity: 0.7,
                helper: function(e) {
                    return $('<div class="drag-helper"><span class="btn btn-default btn-sm">' + that.model.get('username') + '</span></div>');
                },
                cursor: "move",
                cursorAt: {
                    top: 10,
                    left: 10
                },
                scroll: true,
                scrollSensitivity: 100,
            });
            return this;
        }
    });
    var ContentSelectableView = Backbone.View.extend({
        events: {
            'mouseenter .tools .close': 'add_remove_warn',
            'mouseleave .tools .close': 'hide_remove_warn',
            'click .tools .close': 'remove_child',
            'click .tools .choose-requirement': 'choose_requirement',
            'click .selectable': 'select',
            'click .selected': 'unselect',
        },
        tagName: 'li',
        initialize: function(options) {
            this.options = options;
            return this;
        },
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            var that = this;
            return this;
        },
        select: function(e) {
            this.$('.btn').addClass('selected active');
            return this;
        },
        unselect: function(e) {
            this.$('.btn').removeClass('selected active');
            return this;
        },
        add_remove_warn: function(e) {
            this.$('.btn').addClass('btn-danger').removeClass('btn-default');
            return this;
        },
        hide_remove_warn: function(e) {
            this.$('.btn').removeClass('btn-danger').addClass('btn-default');
            return this;
        },
        remove_child: function(e) {
            this.removeFromParent().remove();
            return this;
        },
        removeFromParent: function() {
            console.log(this.options.parent);
            return this;
        },
        choose_requirement: function(e) {
            var chooseview = new ChooseRequirementView({parent: this}).render(e);
            return this;
        }
    });
    var MiniPersonEditView = ContentSelectableView.extend({
        className: 'minipersonedit',
        template: _.template($('#miniperson-editview-template').html()),
        initialize: function(options) {
            this.listenTo(this.model, 'change:username', this.render);
            this.listenTo(this.model, 'remove', this.remove);
            this.options = options;
            return this;
        },
        removeFromParent: function() {
            var parent = this.options.parent;
            parent.save('people', _.without(parent.get('people'), this.model.get('username')));
            return this;
        }
    });
    var MiniEventEditView = ContentSelectableView.extend({
        className: 'minieventedit',
        template: _.template($('#minievent-editview-template').html()),
        initialize: function(options) {
            this.listenTo(this.model, 'change:name', this.render);
            this.listenTo(this.model, 'remove', this.remove);
            this.options = options;
            return this;
        },
        render: function() {
            var json = this.model.toJSON();
            // look at the parents events, find the one with an id matching this model's and get it's requirement
            var parent_event = _.findWhere(this.options.parent.get('events'), {'id': this.model.get('id')});
            if (parent_event) {
                json['requirement'] = parent_event.requirement;
                this.$el.html(this.template(json));
                var that = this;
            }
            return this;
        },
        removeFromParent: function() {
            var parent = this.options.parent;
            parent.save('events', _.reject(parent.get('events'), function(e) {
                return e.id == this.model.get('id');
            }, this));
            return this;
        }
    });
    var ChooseRequirementView = Backbone.View.extend({
        id: 'choose-requirement-div',
        className: 'choose-requirement-div',
        events: {
            'click li': 'choose',
            'blur': 'el_blur'
        },
        initialize: function(options) {
            this.options = options;
            return this;
        },
        render: function(e) {
            this.$el.html('<ul class="list-unstyled"></ul>').appendTo('body').css({
                'top': e.pageY,
                'left': e.pageX,
            }).focus();
            _.each(requirements_list, function(req, code) {
                this.$('ul').append('<li data-code="' + code + '" class="text-' + req.label + '">' + req.text + '</li>');
            }, this);
            var that = this;
            $('body').on('click', function(e) {
                if (!($(e.target).hasClass('choose-requirement-div') ||
                    $(e.target).parent('.choose-requirement-div').length > 0 ||
                    $(e.target).hasClass('choose-requirement'))) {
                    that.remove();
                }
            });
            return this;
        },
        choose: function(e) {
            var code = $(e.target).data('code');
            var parent_event = this.options.parent.model;
            var parent_event_parent = this.options.parent.options.parent;
            var event_id = parent_event.get('id');
            var new_events = _.map(parent_event_parent.get('events'), function(e) {
                if (e.id == event_id) {
                    return {
                        'id': event_id,
                        'requirement': code
                    }
                } else {
                    return e;
                }
            });
            parent_event_parent.save('events', new_events);
            this.options.parent.render();
            return this.remove();
        },
        el_blur: function() {
            this.remove();
        },
        remove: function() {
            $('body').off('click');
            this.$el.remove();
            this.stopListening();
            return this;
        }
    });

    // empty state - a 404
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
            "edit":             "edit_view",
            "edit/":            "remove_slash",
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
        edit_view: function() {
            this.swapView(new EditView());
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
    var App;
    $.when(e_req, j_req, p_req).done(function() {
        // App!
        App = new AppView;

        $('.tooltip-trigger').tooltip();

        // Start router and navigation
        Backbone.history.start();
    });
    function startTimer() {
        return setInterval(function() {
            now = new moment();
            $('.event').each(function() {
                var $el = $(this),
                    start = new moment($el.data('start')),
                    end = new moment($el.data('end'));
                if (start.isBefore(now) && end.isAfter(now)) {
                    $el.addClass('current');
                } else if (end.isBefore(now)) {
                    $el.addClass('past');
                }
            });
        }, 10000);
    }
    var timer = startTimer();
    // identify scrolling as a user action and stops the animation
    $(document).on("scroll mousedown DOMMouseScroll mousewheel keyup", function(e){
        if ( e.which > 0 || e.type === "mousedown" || e.type === "mousewheel") {
             $(document).stop();
        }
    });
    // make mobile taps feel more responsive
    FastClick.attach(document.body);
});
