import settings
from models import Person, Event, Job, Base, Association

from bottle import Bottle, abort, request, run, HTTPResponse, static_file
from sqlalchemy import create_engine

engine = create_engine(settings.dbpath)
Base.metadata.bind = engine

from sqlalchemy.orm import sessionmaker

import json

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
        abort(501)

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

    def get(self, id=None):
        if id:
            match = self.query().get(id).to_dict()
            if match:
                return json.dumps(match)
            abort(404)
        else:
            response = HTTPResponse(status=200, body=json.dumps([m.to_dict() for m in self.query().all()]))
            response.content_type = "application/json"
            return response

    def put(self, id=None):
        if id:
            m = self.query().get(id)
            status = 201
            if m:
                status = 200
            m = self.model()
            response = self.patch(id)
            response.status = status
            return response
        abort(404)

    def patch(self, id=None):
        if id:
            m = self.query().get(id)
            if m:
                for key, value in self.model.from_dict(request.json, self.db).items():
                    # if value being replaced is a model or list of models,
                    # delete it/them from the database first
                    if isinstance(value, list):
                        old = getattr(m, key)
                        newitems = [i for i in value if i not in old]
                        olditems = [i for i in old if i not in value]
                        for item in olditems:
                            old.remove(item)
                            if issubclass(type(item), Association):
                                self.db.delete(item)
                        for item in newitems:
                            old.append(item)
                    else:
                        setattr(m, key, value)
                self.db.commit()
                self.db.refresh(m)
                response = HTTPResponse(status=200, body=json.dumps(m.to_dict()))
                response.content_type = "application/json"
                return response
        abort(404)

    def post(self):
        m = self.model(**self.model.from_dict(request.json, self.db))
        self.db.add(m)
        self.db.commit()
        self.db.refresh(m)
        response = HTTPResponse(status=201, body=json.dumps(m.to_dict()))
        response.content_type = "application/json"
        response.add_header("Location", "{}/{}".format(self.base, m.id))
        return response

    def delete(self, id=None):
        if id:
            m = self.query().get(id)
            if m:
                self.db.delete(m)
                self.db.commit()
                return HTTPResponse(status=200)
            else:
                return HTTPResponse(status=204)
        abort(404)

class PeopleModel(BackboneModel):
    base = '/people'
    model = Person

class EventModel(BackboneModel):
    base = '/events'
    model = Event

class JobModel(BackboneModel):
    base = '/jobs'
    model = Job

class StaticFiles(object):
    def __init__(self, app, root=None):
        self.root = root
        if not self.root:
            raise Exception("Please set the static root.")
        app.route('<filename:path>', 'GET')(self.get)

    def get(self, filename):
        return static_file(filename, root=self.root)

DBSession = sessionmaker()
DBSession.bind = engine
session = DBSession()

app = Bottle()

PeopleModel(app, session)
EventModel(app, session)
JobModel(app, session)
StaticFiles(app, settings.staticroot)

app.run(host='localhost', port='8009', reloader=True);
