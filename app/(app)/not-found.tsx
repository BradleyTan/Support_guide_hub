import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl pt-10">
      <EmptyState icon={FileQuestion} title="That page or guide doesn’t exist" action={<ButtonLink href="/guides">Open the guide library</ButtonLink>}>
        It may have been deleted, or the link has a typo. Guide numbers look like G-1051.
      </EmptyState>
    </div>
  );
}
