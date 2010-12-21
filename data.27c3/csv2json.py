#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Convert special crafted csv data into what a8 believes will be accepted by
the Penta News Game Show software

just run the program. It looks for a file called news_entries_27c3.csv
Note, this file has to be formated like that or everything will fail.
The 
'','','','','','','','',
line has to be in there. The file has to stop with such a line.
"""

import os
import csv
import json

class Question(object):
    """Represent a game question"""
    points = {
       1: '100',
       2: '150',
       3: '225',
       4: '337',
       5: '506',
       6: '759',
       7: '1139',
       8: '1709',
       9: '2563',
       10: '3844',
    }

    def __init__(self, arg):
        super(Question, self).__init__()
        self._init_data(arg)
        
    def _init_data(self, arg):
        """initialise all the data"""
        self.data = {}
        self.data['text'] = arg[1]
        self.data['tier'] = self.points.get(int(arg[0]))
        self.data['answers'] = [
            {'text': val} if num +1 != int(arg[6]) \
            else {'text': val, 'right': True} \
            for num, val in enumerate(arg[2:6])
        ]

        if os.path.isfile("pix/{0}_expl.jpg".format(arg[7])):
           self.data['explanation'] = "pix/{0}_expl.jpg".format(arg[7])
        if os.path.isfile("pix/{0}.jpg".format(arg[7])):
           self.data['image'] = "pix/{0}.jpg".format(arg[7])
        if os.path.isfile("video/{0}.webm".format(arg[7])):
           self.data['video'] = "video/{0}.webm".format(arg[7])

    def get_points(self):
        """docstring for get_points"""
        for key in sorted(self.points.keys()):
            yield self.points[key]

def extract_data(questions):
    """docstring for write_json"""
    #return [json.dumps(question.data, sort_keys=True, indent=2) + ',\n' for question in questions]
    return [question.data for question in questions]

def main():
    csv_fh = csv.reader(open("news_entries_27c3.csv", "rb"), delimiter=';', quotechar="'")
    questions = []
    round = 0
    for entry in csv_fh:
        if len(entry[0]):
            questions.append(Question(entry))
        else:
            fh = open('round_%s.json'% (round), 'w')
            fh.writelines(json.dumps(extract_data(questions), indent=2))
            questions = []
            round += 1

if __name__ == '__main__':
    main()
