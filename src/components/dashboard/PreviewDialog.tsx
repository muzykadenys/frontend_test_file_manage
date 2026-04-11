import { FileImage, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  previewUrl: string | null;
  previewName: string | null;
  onOpenChange: (open: boolean) => void;
};

export function PreviewDialog({ open, previewUrl, previewName, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            {previewName}
          </DialogTitle>
          <DialogDescription className="inline-flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" aria-hidden />
            Preview
          </DialogDescription>
        </DialogHeader>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={previewName ?? ""} className="max-h-[70vh] w-full rounded-md object-contain" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
