from bottle import Bottle, abort, request, run, HTTPResponse
from models import Person, Event, Job, Base
from sqlalchemy import create_engine

engine = create_engine('sqlite:///schedule.db')
Base.metadata.bind = engine

from sqlalchemy.orm import sessionmaker

import json

def jsonRoute(func):
    def inner(*args, **kwargs):
        return json.dumps(func(*args, **kwargs))
    return inner

class RESTModel(object):
    base = None

    def __init__(self, app):
        if not self.base:
            raise Exception("Please set base to the resource path")
        app.route(self.base, 'GET')(self.get)
        app.route(self.base + '/<id>', 'GET')(self.get)
        app.route(self.base + '/<id>', 'PUT')(self.put)
        app.route(self.base + '/<id>', 'PATCH')(self.patch)
        app.route(self.base, 'POST')(self.post)
        app.route(self.base + '/<id>', 'DELETE')(self.delete)

    def get(self, id = None):
        abort(405)

    def put(self, id):
        abort(405)

    def patch(self, id):
        abort(405)

    def post(self):
        """Create"""
        abort(405)

    def delete(self, id):
        abort(405)


class BackboneModel(RESTModel):
    def __init__(self, app, db):
        self.db = db
        super(BackboneModel, self).__init__(app)

    def query(self):
        return self.db.query(self.model)

    @jsonRoute
    def get(self, id=None):
        if id:
            match = self.query().get(id).to_dict()
            if match:
                return match
            abort(404)
        else:
            return [m.to_dict() for m in self.query().all()]

    def put(self, id=None):
        abort(404)

    def post(self):
        m = self.model(**request.json)
        self.db.add(m)
        self.db.commit()
        self.db.refresh(m)
        response = HTTPResponse(status=201, body=json.dumps(m.to_dict()))
        response.add_header("Location", "{}/{}".format(self.base, m.id))
        return response

    def delete(self, id=None):
        m = self.query().get(id)
        if m:
            self.db.delete(m)
            self.db.commit()
            return HTTPResponse(status=200)
        else:
            return HTTPResponse(status=204)
        abort(405)

class PeopleModel(BackboneModel):
    base = '/people'
    model = Person

class EventModel(BackboneModel):
    base = '/events'
    model = Event

class JobModel(BackboneModel):
    base = '/jobs'
    model = Job

DBSession = sessionmaker()
DBSession.bind = engine
session = DBSession()

app = Bottle()
people = PeopleModel(app, session)
events = EventModel(app, session)
jobs = JobModel(app, session)
app.run(host='localhost', port='8009', reloader=True);
