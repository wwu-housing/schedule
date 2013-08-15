# Schedule

Backbone powered scheduling tool.

## Dependancies

The following libraries are included and used in this tool.

* [Backbone.js](http://backbonejs.org/)
* [Bootstrap.js](http://getbootstrap.com)
* [Moment.jsr] (http://momentjs.com/)
* [jQuery](http://jquery.com/)

## Data

The data for this app comes from three json files located in the `json/` directory.

### `event.json`

An array of events. Each event looks like the following.

    {
        "id": 0, // A unique numerical id
        "name": "Event Name",
        "time": {
            "start": "2013-09-18T09:00:00", // ISO formatted datetime
            "end": "2013-09-18T10:30:00     // ISO formatted datetime
        },
        "place": "Location",
        "description": "A description of the event"
    }

### `people.json`

An array of people. Each person looks like the following.

    {
        "id": 0, // A unique numerical id
        "name": "Cameron Little", // Person's name
        "username": "apexskier", // The person's unique username
        "events": [ // an array of mini event objects, min length is 0
            {
                "id": 0, // id of an event
                "requirement": "r" // the key specifying this person's requirement of the event
            },
            {
                "id": 4,
                "requirement": "o"
            }
        ]
    }

### `jobs.json`

An array of jobs. Each job looks like the following.

    {
        "id": 0, // A unique numerical id
        "name": "Job Title",
        "people": ["person1", "apexskier"], // an array of usernames
        "events": [] // same as events for people
    }

### Requirements

The list of requirements is specified within the ``index.html`` file. Each requirement looks like the following.

    "key": { // a unique key for the requirement
        "text": "Name", // the short text term
        "label": "danger", // the bootstrap class for this (determines color)
        "description": "A description for the requirement"
    }
