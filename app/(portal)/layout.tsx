import AuthenticatedShell from "@/components/authenticated-shell";

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
