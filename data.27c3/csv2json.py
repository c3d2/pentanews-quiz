#!/usr/bin/env python
# -*- coding: utf-8 -*-

import csv
import json

class Question(object):
    """Represent a game question"""
    points = {
       1: '50',
       2: '100',
       3: '200',
       4: '300',
       5: '400',
       6: '500',
       7: '600',
       8: '700',
       9:'800',
       10: '900',
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
            else {'text': val, 'right': 'true'} \
            for num, val in enumerate(arg[2:6])
       ]


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
