import * as core from "@actions/core";
import { parseEnvNumber } from "@actions/artifact/lib/internal-utils";
import * as table from "table";
import { dirname } from "path";
import * as fileHelper from "../utils/fileHelper";
import { printPartitionedText } from "../utils/utilities";

const CSV_FILENAME = "ScanReport";
const KEY_RESOURCE_ID = "resourceId";
const KEY_POLICY_ASSG_ID = "policyAssignmentId";
const KEY_POLICY_DEF_ID = "policyDefinitionId";
const KEY_POLICY_SET_ID = "policySetDefinitionId";
const KEY_RESOURCE_TYPE = "resourceType";
const KEY_RESOURCE_LOCATION = "resourceLocation";
const KEY_COMPLIANCE_STATE = "complianceState";
const KEY_POLICY_EVAL = "policyEvaluation";
const TITLE_RESOURCE_ID = "RESOURCE_ID";
const TITLE_POLICY_ASSG_ID = "POLICY_ASSG_ID";
const TITLE_POLICY_DEF_ID = "POLICY_DEF_ID";
const TITLE_POLICY_SET_ID = "INITIATIVE_ID";
const TITLE_RESOURCE_TYPE = "RESOURCE_TYPE";
const TITLE_RESOURCE_LOCATION = "RESOURCE_LOCATION";
const TITLE_COMPLIANCE_STATE = "COMPLIANCE_STATE";
const TITLE_POLICY_EVAL = "POLICY_EVALUATION";
const MAX_LOG_ROWS_VAR = "MAX_LOG_ROWS";
const DEFAULT_MAX_LOG_ROWS = 250;
const ALL_RESOURCE_COMPLIANT = "All resources are compliant";
const RESOURCES_NOT_COMPLIANT = "One or more resources were non-compliant";

export async function generateSummary(): Promise<void> {
  //Get intermediate file path to store success records
  const scanReportPath = fileHelper.getScanReportPath();

  //Fetch all successful non-compliant responses
  const nonCompliantResources = fileHelper.getFileJson(scanReportPath);

  if (nonCompliantResources != null && nonCompliantResources.length > 0) {
    //Console print and csv publish
    printPartitionedText(
      `Policy compliance scan report:: Total records : ${nonCompliantResources.length}`
    );
    let csv_object = printFormattedOutput(nonCompliantResources);

    const skipArtifacts =
      core.getInput("skip-report").toLowerCase() == "true" ? true : false;
    if (!skipArtifacts) {
      const csvName = core.getInput("report-name");
      await createCSV(csv_object, csvName);
    }

    // Check if we need to fail the action
    const ignoreAllScopes: boolean = core.getInput("scopes-ignore") ? core.getInput("scopes-ignore").toLowerCase() == "all" : false;
    if (ignoreAllScopes) {
      printPartitionedText(RESOURCES_NOT_COMPLIANT);
    } else {
      throw Error(RESOURCES_NOT_COMPLIANT);
    }
  } else {
    printPartitionedText(ALL_RESOURCE_COMPLIANT);
  }
}

function getConfigForTable(widths: number[]): any {
  let config = {
    columns: {
      0: {
        width: widths[0],
        wrapWord: true,
      },
      1: {
        width: widths[1],
        wrapWord: true,
      },
      2: {
        width: widths[2],
        wrapWord: true,
      },
      3: {
        width: widths[3],
        wrapWord: true,
      },
      4: {
        width: widths[4],
        wrapWord: true,
      },
      5: {
        width: widths[5],
        wrapWord: true,
      },
      6: {
        width: widths[6],
        wrapWord: true,
      },
      7: {
        width: widths[7],
        wrapWord: true,
      },
    },
  };

  return config;
}

export function printFormattedOutput(data: any[]): any[] {
  const skipArtifacts = core.getInput("skip-report") == "true" ? true : false;
  let maxLogRowsEnvVar = parseEnvNumber(MAX_LOG_ROWS_VAR);
  let maxLogRecords =
    maxLogRowsEnvVar == undefined ? DEFAULT_MAX_LOG_ROWS : maxLogRowsEnvVar;
  //Number.parseInt(core.getInput('max-log-records'));
  let rows: any = [];
  let csvRows: any = [];
  let titles = [
    TITLE_RESOURCE_ID,
    TITLE_POLICY_ASSG_ID,
    TITLE_POLICY_DEF_ID,
    TITLE_RESOURCE_TYPE,
    TITLE_RESOURCE_LOCATION,
    TITLE_POLICY_EVAL,
    TITLE_COMPLIANCE_STATE,
  ];

  // duplicating titles and adding initiative column
  let csvTitles = titles.slice(0);
  csvTitles.push(TITLE_POLICY_SET_ID);

  let logRows = 0;
  try {
    rows.push(titles);
    csvRows.push(csvTitles);

    data.forEach((cve: any) => {
      let row: any = [];
      let csvRow: any = [];
      if (logRows < maxLogRecords) {
        let policyEvaluationLogStr = JSON.stringify(
          cve[KEY_POLICY_EVAL],
          null,
          2
        );
        while (
          policyEvaluationLogStr.indexOf("{") > -1 ||
          policyEvaluationLogStr.indexOf("}") > -1 ||
          policyEvaluationLogStr.indexOf('\\"') > -1
        ) {
          policyEvaluationLogStr = policyEvaluationLogStr
            .replace("{", "")
            .replace("}", "")
            .replace('\\"', "");
        }
        row.push(cve[KEY_RESOURCE_ID]);
        row.push(cve[KEY_POLICY_ASSG_ID]);

        if (cve[KEY_POLICY_SET_ID]) {
          row.push(`${cve[KEY_POLICY_DEF_ID]} \n\n (${cve[KEY_POLICY_SET_ID]})`);
        } else {
          row.push(cve[KEY_POLICY_DEF_ID]);
        }
        row.push(cve[KEY_RESOURCE_TYPE]);
        row.push(cve[KEY_RESOURCE_LOCATION]);
        row.push(policyEvaluationLogStr);
        row.push(cve[KEY_COMPLIANCE_STATE]);
        rows.push(row);
        logRows++;
      }

      if (!skipArtifacts) {
        let policyEvaluationCsvStr = JSON.stringify(
          cve[KEY_POLICY_EVAL],
          null,
          ""
        );
        while (
          policyEvaluationCsvStr.indexOf(",") > -1 ||
          policyEvaluationCsvStr.indexOf("\\n") > -1 ||
          policyEvaluationCsvStr.indexOf('"') > -1
        ) {
          policyEvaluationCsvStr = policyEvaluationCsvStr
            .replace("},", "} || ")
            .replace(",", " | ")
            .replace('"', "")
            .replace("\\", "")
            .replace("\\n", "");
        }
        csvRow.push(cve[KEY_RESOURCE_ID]);
        csvRow.push(cve[KEY_POLICY_ASSG_ID]);
        csvRow.push(cve[KEY_POLICY_DEF_ID]);
        csvRow.push(cve[KEY_RESOURCE_TYPE]);
        csvRow.push(cve[KEY_RESOURCE_LOCATION]);
        csvRow.push(policyEvaluationCsvStr);
        csvRow.push(cve[KEY_COMPLIANCE_STATE]);
        csvRow.push(cve[KEY_POLICY_SET_ID]);
        csvRows.push(csvRow);
      }
    });

    let widths = [20, 20, 20, 20, 15, 45, 15];
    console.log(table.table(rows, getConfigForTable(widths)));
  } catch (error) {
    console.error(
      `An error has occured while parsing results to console output table : ${error}.`
    );
  }
  return csvRows;
}

export async function createCSV(data: any[], csvName: string) {
  try {
    let fileName =
      (csvName ? csvName : CSV_FILENAME + "_" + new Date().valueOf()) + ".csv";
    let filePath = fileHelper.writeToCSVFile(data, fileName);
    await fileHelper.uploadFile(fileName, filePath, dirname(filePath));
  } catch (error) {
    console.error(`An error has occured while writing to csv file : ${error}.`);
  }
}
