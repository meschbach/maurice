
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

module.exports = {
	requireEnvVar,
	ConsoleLogger
};
