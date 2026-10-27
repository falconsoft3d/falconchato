import { Suspense } from "react";
import WidgetApp from "./WidgetApp";

export const metadata = { title: "Chat" };

export default function WidgetPage({ params }: PageProps<"/widget/[siteKey]">) {
  return (
    <>
      <style>{"html,body{background:transparent!important;overflow:hidden}"}</style>
      <Suspense>
        <WidgetApp params={params} />
      </Suspense>
    </>
  );
}
