'use strict';

const cluster = require('cluster');
const SYMBOL = Symbol('listeners');

async function startWorkers() {
	const children = [
		cluster.fork(),
		cluster.fork(),
		cluster.fork(),
		cluster.fork(),
	];

	const startup = children.map(
		worker =>
			new Promise(resolve =>
				worker.on('online', () => {
					console.log(`Worker ${worker.id} started.`);

					resolve(worker);
				}),
			),
	);

	return Promise.all(startup);
}

function stopWorkers() {
	if (cluster.workers) {
		for (const worker of Object.values(cluster.workers)) {
			worker.kill();
		}
	}
}

if (cluster.isPrimary) {
	module.exports = setupClusterSuite;

	function setupClusterSuite(suite) {
		suite.add(
			'collect',
			async (client, registry) => {
				await registry.clusterMetrics();
			},
			{ setup, teardown: stopWorkers },
		);
	}

	async function setup(client) {
		await startWorkers();

		for (const listener of cluster.listeners('message')) {
			cluster.removeListener('message', listener);
		}

		if (client[SYMBOL]) {
			for (const listener of client[SYMBOL]) {
				cluster.addListener('message', listener);
			}
		}

		const aggregator = new client.AggregatorRegistry();

		client[SYMBOL] = cluster.listeners('message');

		return aggregator;
	}
} else {
	//TODO: This is running Counter@current regardless of the run
	const { Counter, AggregatorRegistry, collectDefaultMetrics } = require('../');
	const { getLabelCombinations } = require('./utils/labels');

	new AggregatorRegistry();

	collectDefaultMetrics({
		gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // These are the default buckets.
	});

	module.exports = () => {};

	const labelNames =
		'single letter labels make poor approximations of real label interpolation behavior for real metrics'.split(
			' ',
		);

	const counter = new Counter({
		name: 'Counter',
		help: 'Counter',
		labelNames,
	});

	const combinations = getLabelCombinations(
		[3, 5, 2, 4, 8, 7, 1, 3],
		labelNames,
	);

	function incrementCounters() {
		for (const labels of combinations) {
			counter.inc(labels, 1);
		}
	}

	incrementCounters();

	setInterval(incrementCounters, 25);
}
