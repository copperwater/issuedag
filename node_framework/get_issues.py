#!/usr/bin/python3

import json
from urllib import request

page = 1
owner = 'YACS-RCOS'
repo = 'yacs'

def minify(obj):
    return {
            'number': obj['number'],
            'title': obj['title'],
            'url': obj['html_url']
            }

issues = []

while True:
    url = 'http://api.github.com/repos/' + owner + '/' + repo + '/issues?direction=asc&page=' + str(page)
    response = request.urlopen(url)
    github_json = json.loads(response.read())

    # stop when a page is reached that doesn't have any more issues on it
    if len(github_json) < 1:
        break

    issues += [minify(elem) for elem in github_json if not 'pull_request' in elem]
    page += 1

print(json.dumps(issues, indent=2, sort_keys=True))
