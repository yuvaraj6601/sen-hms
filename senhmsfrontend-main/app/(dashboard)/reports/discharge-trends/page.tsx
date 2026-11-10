import AnalyticsReport from "../_components/AnalyticsReport";

export default function DischargeTrendsPage() {
  return <AnalyticsReport type="DISCHARGE" title="Discharge Trends" groupable defaultChart="line" />;
}
