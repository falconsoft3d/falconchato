import Shell from "@/components/dashboard/Shell";

export const metadata = { title: "falconchato" };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <Shell>{children}</Shell>;
}
