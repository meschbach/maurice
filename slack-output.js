const { IncomingWebhook } = require('@slack/webhook');

async function createNotificationFactory(context, config){
	// Read a url from the environment variables
	const url = config["webhook-url"];

	// Initialize
	const webhook = new IncomingWebhook(url);
	return {
		notify: async (message) => {
			await webhook.send({text: message});
		}
	}
}

module.exports = {
	createNotificationFactory
};
