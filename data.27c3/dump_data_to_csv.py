#!/usr/bin/env python

# -*- coding: utf-8 -*-

"""
Dump the Pentasubmitter data via Django ORM to intermediate csv format
"""

__author__ = "Frank Becker <fb@alien8.de>"
__version__ = "$Revision: 0.0 $"
__date__ = "$Date: YDATE $"
__copyright__ = "Copyright (c) 2010 Frank Becker"
__license__ = "Python"

import unicodedata
from submitter import models

def get_news_entry_as_csv(news_entry):
    """return submitter.models.NewsEntry() as csv

    id - unique db id
    title - title of news enty
    URL - the url for reference
    tags - tag list seperated by ,
    screenshot - Link to screenshot of original page
    """
    title = unicodedata.normalize('NFKD', news_entry.title).encode(
        'ascii', 'ignore')
    return "; ".join([
        str(news_entry.id),
        title,
        news_entry.get_absolute_url(),
        news_entry.page_screenshot.url + "\n",
    ])

def main():
    """docstring for main"""
    news_entries = models.NewsEntry.objects.all()
    fh = open('news_entries.csv', 'w')
    for ne in news_entries:
        fh.write(get_news_entry_as_csv(ne))


if __name__ == '__main__':
    main()

# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4 fileencoding=utf-8 :

