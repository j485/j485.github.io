// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

// Require process, so we can mock environment variables.
const process = require('process');

const express = require('express');
const bodyParser = require('body-parser');
const Knex = require('knex');

const app = express();
app.set('view engine', 'pug');
app.enable('trust proxy');

// Automatically parse request body as form data.
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Set Content-Type for all responses for these routes.
app.use((req, res, next) => {
  res.set('Content-Type', 'text/html');
  next();
});

// Create a Winston logger that streams to Stackdriver Logging.
const winston = require('winston');
const {LoggingWinston} = require('@google-cloud/logging-winston');
const loggingWinston = new LoggingWinston();
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console(), loggingWinston],
});

// [START cloud_sql_postgres_knex_create]
// Initialize Knex, a Node.js SQL query builder library with built-in connection pooling.
const connect = () => {
  // Configure which instance and what database user to connect with.
  // Remember - storing secrets in plaintext is potentially unsafe. Consider using
  // something like https://cloud.google.com/kms/ to help keep secrets secret.
  const config = {
    user: process.env.DB_USER, // e.g. 'my-user'
    password: process.env.DB_PASS, // e.g. 'my-user-password'
    database: process.env.DB_NAME, // e.g. 'my-database'
  };

  config.host = `/cloudsql/${process.env.CLOUD_SQL_INSTANCE_NAME}`;

  // Establish a connection to the database
  const knex = Knex({
    client: 'pg',
    connection: config,
  });

  // ... Specify additional properties here.
  // [START_EXCLUDE]

  // [START cloud_sql_postgres_knex_limit]
  // 'max' limits the total number of concurrent connections this pool will keep. Ideal
  // values for this setting are highly variable on app design, infrastructure, and database.
  knex.client.pool.max = 5;
  // 'min' is the minimum number of idle connections Knex maintains in the pool.
  // Additional connections will be established to meet this value unless the pool is full.
  knex.client.pool.min = 5;
  // [END cloud_sql_postgres_knex_limit]
  // [START cloud_sql_postgres_knex_timeout]
  // 'acquireTimeoutMillis' is the maximum number of milliseconds to wait for a connection checkout.
  // Any attempt to retrieve a connection from this pool that exceeds the set limit will throw an
  // SQLException.
  knex.client.pool.createTimeoutMillis = 30000; // 30 seconds
  // 'idleTimeoutMillis' is the maximum amount of time a connection can sit in the pool. Connections that
  // sit idle for this many milliseconds are retried if idleTimeoutMillis is exceeded.
  knex.client.pool.idleTimeoutMillis = 600000; // 10 minutes
  // [END cloud_sql_postgres_knex_timeout]
  // [START cloud_sql_postgres_knex_backoff]
  // 'createRetryIntervalMillis' is how long to idle after failed connection creation before trying again
  knex.client.pool.createRetryIntervalMillis = 200; // 0.2 seconds
  // [END cloud_sql_postgres_knex_backoff]
  // [START cloud_sql_postgres_knex_lifetime]
  // 'acquireTimeoutMillis' is the maximum possible lifetime of a connection in the pool. Connections that
  // live longer than this many milliseconds will be closed and reestablished between uses. This
  // value should be several minutes shorter than the database's timeout value to avoid unexpected
  // terminations.
  knex.client.pool.acquireTimeoutMillis = 600000; // 10 minutes
  // [START cloud_sql_postgres_knex_lifetime]

  // [END_EXCLUDE]
  return knex;
};

const knex = connect();
// [END cloud_sql_postgres_knex_create]

// [START cloud_sql_postgres_knex_connection]
/**
 * Insert a vote record into the database.
 *
 * @param {object} knex The Knex connection object.
 * @param {object} vote The vote record to insert.
 * @returns {Promise}
 */
const insertVote = async (knex, vote) => {
  try {
    return await knex('votes').insert(vote);
  } catch (err) {
    throw Error(err);
  }
};
// [END cloud_sql_postgres_knex_connection]

/**
 * Retrieve the latest 5 vote records from the database.
 *
 * @param {object} knex The Knex connection object.
 * @returns {Promise}
 */
const getEmujis = async knex => {
	try {
  	return await knex
  	  .select('emoji', 'artist', 'song', 'spotify_uri')
  	  .from('emujis')
  	  .limit(5);
	} catch (err) {
		throw err;
	}
};

/**
 * Retrieve the total count of records for a given candidate
 * from the database.
 *
 * @param {object} knex The Knex connection object.
 * @param {object} candidate The candidate for which to get the total vote count
 * @returns {Promise}
 */
const getEmuji = async (knex, spotify_uri) => {
	try {
  	return await knex
			.select('song')
  	  .from('emujis')
  	  .where('spotify_uri', spotify_uri);
	} catch (err) {
		throw err;
	}
};

app.get('/', (req, res) => {
  (async function() {
		try {
			const data = await getEmujis(knex);
			console.log('data ', data)
			res.status(200).json({
				message: 'handled get request',
				data: data
			});
		} catch (err) {
    	logger.error(`error while attempting to fetch emujis:${err}`);
    	res
    	  .status(500)
    	  .send('unable to fetch emujis')
    	  .end();
    	return;
  	}
  })();
});

app.get('/:spotifyUri', (req, res) => {
  (async function() {
		const uri = req.params.spotifyUri
		try {
			const data = await getEmuji(knex, uri);
			console.log('data ', data)
			res.status(200).json({
				message: 'handled get request',
				data: data[0]['song']
			});
		} catch (err) {
    	logger.error(`error while attempting to fetch emuji:${err}`);
    	res
    	  .status(500)
    	  .send('unable to fetch emuji')
    	  .end();
    	return;
  	}
  })();
});

app.post('/', async (req, res) => {
  res.status(200).send('successfully handled post request').end();
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = server;
