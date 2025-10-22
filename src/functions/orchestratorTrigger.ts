import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Resource } from "sst";

const sfnClient = new SFNClient({});

export async function handler() {
  console.log("--- OrchestratorTrigger handler invoked by Cron ---");

  const stateMachineArn = Resource.FauxiosOrchestrator.arn;

  console.log(`Starting execution of state machine: ${stateMachineArn}`)

  try {
    const command = new StartExecutionCommand({
      stateMachineArn: stateMachineArn,
      input: JSON.stringify({}), // You can pass an initial input here if needed
    });
    await sfnClient.send(command);
    console.log("State machine execution started successfully.");
  } catch (error) {
    console.error("Error starting state machine execution:", error);
    throw error;
  }

  return {
    statusCode: 200,
    body: "State machine execution started successfully.",
  };
};