'use strict';

const cluster = require('cluster');
const debug = require('debug')(`benchmark:worker-${cluster.worker.id}`);
const workers = require('./utils/workers');

function setupWorkerSuite(suite) {
	suite.add('workers', runCounters, { setup, teardown });
}

function setup() {
	const labelNames =
		'single letter labels make poor approximations of real label interpolation behavior'.split(
			' ',
		);

	return { labelNames };
}

let running = false;

async function runCounters(client, { labelNames }) {
	if (running) {
		return;
	} else {
		running = true;
	}

	// We cannot do this check in setup because of benchmark-regressions'
	// poor hooking of benchmark.js' lifecycle events. And so most of the
	if (workers.version !== process.env.version) {
		debug(
			`Skipping runCounters() ${workers.version} vs ${process.env.version}`,
		);
		return;
	}

	debug(`runCounters() ${workers.version}`);

	const { AggregatorRegistry, Counter, collectDefaultMetrics } = client;
	const { getLabelCombinations } = require('./utils/labels');
	const combinations = getLabelCombinations([3, 5, 2, 4, 8, 7, 1], labelNames);
	const counter = new Counter({
		name: `Counter`,
		help: 'Counter',
		labelNames,
	});

	collectDefaultMetrics({
		gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // These are the default buckets.
	});

	function incrementCounters() {
		for (const labels of combinations) {
			counter.inc(labels, 1);
		}
	}

	process.send('listening', event => {
		debug(`'listening' -> ${event}`);
	});

	const aggregator = new AggregatorRegistry();

	incrementCounters();

	// It would be better 'incrementCounters' was the entire run method,
	// but see above for why this function is so convoluted
	process.on('message', incrementCounters);

	return aggregator;
}

function teardown() {
	if (workers.version !== process.env.version) {
		debug('teardown - nothing to do');
		return;
	}

	debug(`waiting for disconnect() from cluster benchmark ${workers.version}`);

	return new Promise(resolve => {
		process.on('disconnect', () => {
			debug('disconnect');
			resolve();
		});
	});
}

module.exports = setupWorkerSuite;
