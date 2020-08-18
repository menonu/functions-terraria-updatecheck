import { AzureFunction, Context } from "@azure/functions";
import { CosmosClient, Container } from "@azure/cosmos";
import axios from "axios";
import * as cheerio from "cheerio";

interface VerObj {
  id: string;
  date: string;
  versionstring: string;
}

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  var timeStamp = new Date().toISOString();

  const response = await axios.get("https://terraria.org/");
  const $ = cheerio.load(response.data);
  const footer = $("div.page-footer > a");
  const dedicated = footer.toArray().filter((my) => $(my).text().includes("PC Dedicated Server"));
  const version_text = $(dedicated).attr("href").split("/").pop();
  console.log(version_text);

  const notify = async (version: string) => {
    // post slack
    const webhook_url = process.env["SLACK_WEBHOOK_URL"];
    const contents = {
      text: `<!channel> New Terraria Server.
  ${version}
  <https://terraria.org/>`,
    };

    await axios.post(webhook_url, JSON.stringify(contents));
  };

  const insertnew = async (c: Container, v: string) => {
    await c.items.create({
      id: "latest",
      date: new Date().toISOString(),
      versionstring: v,
    });
  };

  const updatecurrent = async (c: Container, current: any, next: string) => {
    const prev = current.versionstring;
    if (prev !== next) {
      notify(next);
    }

    const v = {
      ...current,
      date: new Date().toISOString(),
      versionstring: next,
    };

    await c.item("latest").replace(v);
  };

  const endpoint = process.env["AZFDB_EP"];
  const key = process.env["AZFDB_KEY"];
  const client = new CosmosClient({ endpoint, key });
  const container = await client.database("azfdb").container("terrariaserver");

  const { resource: latest } = await container.item("latest").read();

  if (!latest) {
    await insertnew(container, version_text);
  } else {
    await updatecurrent(container, latest, version_text);
  }

  console.log(version_text);
};

export default timerTrigger;
