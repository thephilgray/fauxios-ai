import { Resource } from "sst";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Buffer } from 'buffer';

const sfnClient = new SFNClient({});

async function invokeGenerator() {
  // const mockEvent = {
  //   headline: "Local Cat Elected Mayor in Landslide Victory, Promises More Naps and Tuna Subsidies",
  //   summary: "In a surprising turn of events, a feline named Chairman Meow has been elected mayor of a small town, campaigning on a platform of increased napping opportunities and a universal tuna subsidy program. Residents are cautiously optimistic about the new administration."
  // };

  try {
    console.log("Invoking FauxiosOrchestrator...");
    const command = new StartExecutionCommand({
      stateMachineArn: Resource.FauxiosOrchestrator.arn,
      input: JSON.stringify({}),
    });
    const { executionArn } = await sfnClient.send(command);
    console.log(`FauxiosOrchestrator started successfully. Execution ARN: ${executionArn}`);
  } catch (error) {
    console.error("Error starting FauxiosOrchestrator execution:", error);
  }
}

invokeGenerator();
