'use strict';

const cluster = require('cluster');
const debug = require('debug')('benchmark');

async function startWorkers(count = 2) {
	debug(`startWorkers(${count})`);

	const workers = [];

	for (let i = 0; i < count; i++) {
		workers.push(createWorker());
	}

	return Promise.all(workers);
}

async function createWorker() {
	const env = { ...process.env, version: running };

	return new Promise((resolve, reject) => {
		const worker = cluster.fork(env);

		const failure = new Event(`Worker ${worker.id} did not start.`);
		const timeout = setTimeout(() => {
			Error.captureStackTrace(failure);
			reject(failure);
		}, 15_000);

		timeout.unref();

		worker.on('message', event => {
			if (event === 'listening') {
				debug(`Worker ${worker.id} started.`);

				clearTimeout(timeout);

				resolve(worker);
			}
		});

		worker.on('exit', () => {
			debug(`Worker ${worker.id} exited.`);
		});

		worker.on('disconnect', () => debug(`Worker ${worker.id} disconnected.`));
		worker.on('fork', () => debug(`Worker ${worker.id} forked.`));
		worker.on('online', () => debug(`Worker ${worker.id} online.`));
	});
}

async function stopWorkers() {
	const promises = [];

	debug('stopWorkers()');

	for (const worker of Object.values(cluster.workers)) {
		promises.push(
			new Promise(resolve => {
				worker.disconnect();

				const timeout = setTimeout(() => {
					debug(`worker[${worker.id}].kill()`);
					worker.kill();
					resolve(worker);
				}, 2000);

				worker.on('disconnect', () => {
					debug(`worker[${worker.id}] disconnected.`);
					clearTimeout(timeout);
					resolve(worker);
				});
			}),
		);
	}

	await Promise.all(promises);
}

let running = 'current';

module.exports = {
	startWorkers,
	stopWorkers,
	get version() {
		return running;
	},
	set version(version) {
		running = version;
		if (process.env.version) {
			debug(
				`version: '${version}', process.env.version: ${process.env.version}`,
			);
		} else {
			debug(`version: '${version}'`);
		}
	},
};
