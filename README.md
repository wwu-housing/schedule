# Schedule

Backbone powered scheduling tool. Creates a schedule of events, showing
attendance requirements according to job or specific person. Web editable,
with a quick overview available to see all data.

Intended for short (around a week long) busy periods, where different people
have different responsibilities and schedules change frequently.

## Installation

```bash
git clone git@github.com:wwu-housing/schedule.git
cd schedule
mkvirtualenv schedule
pip install -r requirements.txt
```

Run with `python app.py`. With the default settings, this will use (or create)
a sqlite database called `schedule.db` in the current directory and serve
everything to `localhost:8009`.

## Dependencies

### Javascript

The following libraries are included and used in this tool.

* [Backbone.js](http://backbonejs.org/)
* [Underscore.js](http://underscorejs.org/)
* [Bootstrap.js](http://getbootstrap.com)
* [Moment.js] (http://momentjs.com/)
* [jQuery](http://jquery.com/)
* [jQuery UI](http://jqueryui.com/)
* [Touch Punch](http://touchpunch.furf.com/)
* [FastClick](https://github.com/ftlabs/fastclick)

### Python

Install through pip using the requirements.txt file.

* [SQLAlchemy](http://www.sqlalchemy.org/)
* [bottle](http://bottlepy.org)

## Data

The data for this app is stored in a sqlite database (currently). The filename
can be specified in the `settings.py` file.

### Requirements

The list of requirements is specified within the ``static/index.html`` file.
Each requirement looks like the following.

```js
"key": { // a unique key for the requirement
    "text": "Name", // the short text term
    "label": "danger", // the bootstrap class for this (determines color)
    "description": "A description for the requirement"
}
```
