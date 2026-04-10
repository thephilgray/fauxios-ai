import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Resource } from "sst";
import type { Handler } from "aws-lambda";
import { randomUUID } from "crypto";

const sfnClient = new SFNClient({});

export const handler: Handler = async (event) => {
  console.log("--- TruthReel Orchestrator Trigger Invoked ---");

  try {
    const orchestratorArn = Resource.TruthReelOrchestrator.arn;
    if (!orchestratorArn) {
        throw new Error("TruthReelOrchestrator ARN not found.");
    }

    const command = new StartExecutionCommand({
      stateMachineArn: orchestratorArn,
      name: `TruthReelExecution-Cron-${randomUUID()}`,
      input: JSON.stringify({}),
    });

    const response = await sfnClient.send(command);
    console.log(`Successfully started execution: ${response.executionArn}`);
    
    return {
        statusCode: 200,
        body: `Started execution: ${response.executionArn}`
    }

  } catch (error) {
    console.error("Error triggering TruthReel orchestrator:", error);
    throw error;
  }
};
