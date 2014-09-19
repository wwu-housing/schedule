from bottle import abort, request
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
        abort(405)

    def patch(self, id):
        abort(405)

    def post(self):
        abort(405)

    def delete(self, id):
        abort(405)


class PeopleModel(RESTModel):
    base = '/people'

    def get(self, id = None):
        with open ('./json/people.json') as f:
            people = json.load(f)

            if id:
                if id in people:
                    return people[id]
                else:
                    abort(404)
            else:
                return people

    def put(self, id):
        with open('/json/people.json') as f:
            people = json.load(f)

            if id in people:
                people[id] = request.json
                return people[id]

        abort(404)

    def post(self):
        with open('/json/people.json') as f:
            people = json.load(f)

            people
        abort(405)

    def delete(self, id):
        abort(405)
