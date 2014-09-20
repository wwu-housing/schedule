from bottle import Bottle, abort, request, run
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

    def __init__(self, app, db, model):
        self.db = db
        self.model = model

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


class PeopleModel(RESTModel):
    base = '/people'

    @jsonRoute
    def get(self, id=None):
        if id:
            match = self.db.query(self.model).filter(Person.id == id).all()
            if len(match) > 1:
                abort(500)
            if len(match) == 0:
                abort(404)
            return match[0]
        else:
            return self.db.query(self.model).all()

    def put(self, id):
        with open('/json/people.json') as f:
            people = json.load(f)

            if id in people:
                people[id] = request.json
                return people[id]

        abort(404)

    def post(self):
        raise Exception(request.json)

    def delete(self, id):
        abort(405)

DBSession = sessionmaker()
DBSession.bind = engine
session = DBSession()

app = Bottle()
people = PeopleModel(app, session, Person)
app.run(host='localhost', port='8009', reloader=True);
