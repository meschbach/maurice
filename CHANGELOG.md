# Change Log

## v0.4.1

* Fixes warnings printed on the console for both the _Ally Invest_ and _CouchDB Quotes_ modules regarding exceeding the
maximum number of listeners.  This is expected in cases where more than 10 stocks are being queried or stored.

## v0.4.0

* Use Reactor pattern for _Ally Invest_ quotes streams to batch queries, thus removing linear scale of querying in
respect to the symbols.
* Updates Couch related infrastructure to use junk-bucket 1.5.0 features.

## v0.3.1

* Fixes dependency being in `dev` scope as opposed to `production` scope.

## v0.3.0

* Journaling quotes stream to CouchDB
* Live watching of quotes
* Removal of Yahoo Finance since it depended on a library with security concerns.

## v0.2.0

Contuation after Treshold.  Major changes:
* Continue processing threshold after one has changed.

## v0.1.0

Initial version released.  Major changes:
* Able to watch a ticker and notify on upward movement beyond a threshold.
