#!/bin/sh

java \
  -Djava.library.path=. \
  -classpath \
    jars/jetty-all-7.2.2.v20101205.jar:jars/js.jar:jars/servlet-api-2.5.jar: \
  org.mozilla.javascript.tools.shell.Main bootstrap.js $*
