import config from "@config";
import { BookingFlow } from "@/components/BookingFlow";
import { horizonKey, todayKey } from "@/lib/availability";

export const dynamic = "force-dynamic";

export default function Page() {
  const now = new Date();

  // Only what the page shows is passed down. The host email and the limits
  // stay on the server.
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <BookingFlow
        todayKey={todayKey(config, now)}
        horizonKey={horizonKey(config, now)}
        businessName={config.businessName}
        pageTitle={config.pageTitle}
        hostName={config.host.name}
        hostTimeZone={config.timeZone}
        meetingTypes={config.meetingTypes}
        locations={config.locations}
      />
    </main>
  );
}
