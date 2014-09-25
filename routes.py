from models import Person, Event, Job, Base, Association

from bottle import abort, request, run, HTTPResponse, static_file

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
        abort(405)

    def delete(self, id):
        abort(405)


class BackboneModel(RESTModel):
    def __init__(self, app, db):
        self.db = db
        app.route(self.base, 'PUT')(self.putall)
        super(BackboneModel, self).__init__(app)

    def query(self):
        return self.db.query(self.model)

    def insert(self, params):
        m = self.model(**self.model.from_dict(params, self.db))
        self.db.add(m)
        self.db.commit()
        self.db.refresh(m)
        return m

    def putall(self):
        self.query().delete()
        for item in request.json:
            self.insert(item)
        return HTTPResponse(status=200, body=json.dumps([i.to_dict() for i in self.query().all()]))

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
                self.db.delete(m)
                status = 200
            m = self.model()
            response = self.post()
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
        m = self.insert(request.json)
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

class People(BackboneModel):
    base = '/people'
    model = Person

class Events(BackboneModel):
    base = '/events'
    model = Event

class Jobs(BackboneModel):
    base = '/jobs'
    model = Job

class StaticFiles(object):
    def __init__(self, app, root=None):
        self.root = root
        if self.root == None:
            raise Exception("Please set the static root.")
        app.route('<filename:path>', 'GET')(self.get)

    def get(self, filename):
        return static_file(filename, root=self.root)
