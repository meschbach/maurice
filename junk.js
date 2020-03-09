const {Readable,Writable} = require("stream");

function requireEnvVar(name, description){
	const value =process.env[name];
	if( !value ){
		throw new Error("env " + name + " "+ description);
	}
	return value;
}

class ConsoleLogger {
	info(...args) { console.info(...args); }
	error(...args) { console.error(args); }
	child(name) { return this; }
}

class AsyncWritable extends Writable {
	constructor(properties) {
		super(properties);
	}

	_write(chunk, encoding, callback) {
		const promise = this._doWrite(chunk,encoding);
		promise.then(() => {
			callback(null);
		}, (e) => {
			callback(e);
		})
	}

	async _doWrite(chunk, encoding) {
		throw new Error("Not implemented");
	}
}


class AsyncSingleRead extends Readable {
	constructor(properties) {
		super(properties);
	}

	_read(size) {
		const promise = this._doRead(size);
		Promise.resolve(promise).then((result) => {
			this.push(result);
		}, (e) => {
			this.emit("error", e);
		});
	}

	async _doRead(size) {
		throw new Error("Not implemented");
	}
}

const {main} = require("junk-bucket");
const {Context} = require("junk-bucket/context");

function service(name, fn) {
	main(async (l) => {
		const processContext = new Context(name,l);
		try {
			await fn(processContext);
		}catch(e){
			await processContext.cleanup();
			throw e;
		}

		let cleanedUp = false;
		async function doCleanUp(){
			if( cleanedUp ) return;

			cleanedUp = true;
			await processContext.cleanup();
		}
		process.on("SIGINT", doCleanUp);
		process.on("SIGTERM",  doCleanUp);
	}, new ConsoleLogger());
}

const assert = require("assert");
async function loadModule( context, contextName, moduleCache, moduleName, modelConfig, defaultInitName ){
	assert(moduleName);

	if( moduleCache[moduleName] ){
		return moduleCache[moduleName];
	}

	const matchingConfigs = modelConfig.filter((c) => c.name == moduleName );
	if( matchingConfigs.length != 1 ) {
		context.logger.error("Could not find output module", moduleName, modelConfig);
		throw new Error("Expected an input by name of " + moduleName + ", got " + matchingConfigs.length);
	}

	const moduleDescriptor = matchingConfigs[0];
	const loadedModule = require(moduleDescriptor.module);
	const config = moduleDescriptor.config;

	const moduleContext = context.subcontext(contextName);
	const initFn = loadedModule[moduleDescriptor.initializer || defaultInitName];
	if (!initFn) {
		throw new Error("Module initializer is falsy for " + contextName);
	}
	const initializedModule = await initFn(moduleContext, config);
	moduleCache[moduleName] = initializedModule;
	return initializedModule;
}

class LoggingWritable extends Writable {
	constructor(logger) {
		super({
			objectMode: true
		});
		this.logger = logger;
	}

	_write(obj, encoding, callback) {
		this.logger.info(obj);
		callback();
	}
}

module.exports = {
	AsyncWritable,
	AsyncSingleRead,
	requireEnvVar,
	ConsoleLogger,
	LoggingWritable,
	loadModule,
	service
};
