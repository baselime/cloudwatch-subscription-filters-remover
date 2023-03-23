const AWS = require("aws-sdk");

const logs = new AWS.CloudWatchLogs({ region: process.env.AWS_REGION });


function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function listLogGroups() {

  let groups = [];
  let marker = null;
  do {
    try {
      const { logGroups, nextToken } = (await logs.describeLogGroups({ nextToken: marker }).promise());
      if (logGroups) {
        groups = [...groups, ...logGroups];
      }
      marker = nextToken;
      await delay(100);
    } catch (error) {
      console.error(JSON.stringify({ message: "Wait 5 seconds before doing anything", error }));
      console.log(error);
      await delay(5000);
    }
  } while (marker);
  return groups;
}


async function command(event) {
  const { Records } = event;

  const [record,] = Records;

  let message = JSON.parse(record.body || "");
  if (message.Message) { message = JSON.parse(message.Message); }

  if (!message.prefix) {
    throw new Error(`Missing subscription prefix in the command message: ${JSON.stringify(message)}`);
  }

  logger.info("Deleting the log group subscription filters", message);
  const groups = await listLogGroups();

  logger.info("All the log groups in the region", { groups: groups.map(fn => fn.logGroupName) });
  if (!groups || groups.length === 0) {
    return;
  }

  const promises = groups.map(async group => {
    logger.info("Processing log group", { group: group.logGroupName });
    const { logGroupName } = group;

    let subscription;

    try {
      const subscriptions = (await logs.describeSubscriptionFilters({ logGroupName, }).promise()).subscriptionFilters;
      logger.info("The subscription filters found for this log group", { logGroupName, subscriptions, });
      if (!subscriptions || subscriptions.length === 0) return;
      subscription = subscriptions.find(s => s.filterName.startsWith(message.prefix));
      if (!subscription) return;
    } catch (error) {
      if (error.code === "ThrottlingException") {
        await delay(400);
        try {
          const subscriptions = (await logs.describeSubscriptionFilters({ logGroupName, }).promise()).subscriptionFilters;
          logger.info("The subscription filters found for this log group", { logGroupName, subscriptions, });
          if (!subscriptions || subscriptions.length === 0) return;
          subscription = subscriptions.find(s => s.filterName.startsWith(message.prefix));
          if (!subscription) return;
        } catch (error) {
          logger.error("There was an error listing the log subscription filter", { error, params });
          return;
        }
      } else {
        logger.error("There was an error listing the log subscription filter; Not ThrottlingException", { error, params });
        return;
      }
    }

    const params = {
      logGroupName,
      filterName: subscription.filterName
    };

    try {
      await logs.deleteSubscriptionFilter(params).promise();
      logger.info("Deleted the subscription filter", { params });
      return logGroupName;
    } catch (error) {
      if (error.code === "ThrottlingException") {
        await delay(400);
        try {
          await logs.putSubscriptionFilter(params).promise();
          logger.error("Deleted the subscription filter", params);
        } catch (error) {
          logger.error("There was an error deleting the log subscription filter", { error, params });
        }
      } else {
        logger.error("There was an error deleting the log subscription filter; Not ThrottlingException", { error, params });
      }
    }
  });

  const res = await Promise.all(promises);
  logger.info("Deleted the log subscription filters", { res: res.filter(r => r) });
}


const logger = {
  info: (message, data) => { console.info(JSON.stringify({ message, data })) },
  error: (message, data) => { console.error(JSON.stringify({ message, data })) },
}

module.exports = {
  command,
}
