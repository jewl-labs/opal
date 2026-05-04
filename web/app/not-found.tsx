import Container from "@/components/common/container";

export default function NotFound() {
  return (
    <Container className="flex h-screen items-center justify-center border-x border-dashed border-muted-foreground/50">
      <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
    </Container>
  );
}