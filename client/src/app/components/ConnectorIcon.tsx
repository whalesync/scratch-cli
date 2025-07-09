import { Image } from "@mantine/core";
import { ImageProps } from "next/image";

export function ConnectorIcon(
  props: { connector: string | null } & Omit<ImageProps, "src" | "alt">
) {
  let iconUrl = props.connector
    ? connectorIconMap[props.connector?.toUpperCase() || ""]
    : "";
  if (!iconUrl) {
    iconUrl = connectorIconMap["POSTGRES"];
  }

  return (
    <Image
      src={iconUrl}
      w={40}
      h={40}
      alt={props.connector || "Connector icon"}
      {...props}
    />
  );
}

// Map of connector names to their icon file paths
export const connectorIconMap: Record<string, string> = {
  AFFINITY: "/connector-icons/affinity.svg",
  AIRTABLE: "/connector-icons/airtable.svg",
  APOLLO: "/connector-icons/apollo.svg",
  ATTIO: "/connector-icons/attio.svg",
  GOOGLESHEETS: "/connector-icons/google-sheets.svg",
  HUBSPOT: "/connector-icons/hubspot.svg",
  MEMBERSTACK: "/connector-icons/memberstack.svg",
  NOTION: "/connector-icons/notion.svg",
  POSTGRES: "/connector-icons/postgres.svg",
  SALESFORCE: "/connector-icons/salesforce.svg",
  SNOWFLAKE: "/connector-icons/snowflake.svg",
  STRIPE: "/connector-icons/stripe.svg",
  SUPABASE: "/connector-icons/supabase.svg",
  WEBFLOW: "/connector-icons/webflow.svg",
  YOUTUBE: "/connector-icons/webflow.svg",
};
