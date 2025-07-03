'use strict';

const cluster = require('cluster');
const workers = require('./utils/workers');

const SYMBOL = Symbol('listeners');

function setupClusterSuite(suite) {
	suite.add(
		'collect',
		async (client, registry) => {
			await startWorkers(2);
			await registry.clusterMetrics();
		},
		{ setup, teardown },
	);
}

async function setup(client) {
	// This is a workaround for benchmark-regression having two copies
	// of prom-client loaded, both listening on 'message' from child processes
	for (const listener of cluster.listeners('message')) {
		cluster.removeListener('message', listener);
	}

	// This allows for multiple tests in the suite to toggle between versions
	if (client[SYMBOL]) {
		for (const listener of client[SYMBOL]) {
			cluster.addListener('message', listener);
		}
	}

	const aggregator = new client.AggregatorRegistry();

	client[SYMBOL] = cluster.listeners('message');

	return aggregator;
}

let workerPromise;

// This is an unfortunate effect of benchmark-regressions not
// relying on Benchmark.js's lifecycle mechanisms, so we don't
// know the correct code to run in the worker until 'started' is
// emitted - and what cost by far the most effort in writing these
// benchmarks
async function startWorkers() {
	if (!workerPromise) {
		workerPromise = workers.startWorkers(2);
	}

	return workerPromise;
}

async function teardown() {
	workerPromise = undefined;
	await workers.stopWorkers();
}

module.exports = setupClusterSuite;
