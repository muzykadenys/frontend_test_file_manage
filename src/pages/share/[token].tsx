import React from "react";
import Head from "next/head";
import { NextRouter, withRouter } from "next/router";
import * as api from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { File, Folder, KeyRound, Share2 } from "lucide-react";

type State = {
  loading: boolean;
  error: string | null;
  data: Awaited<ReturnType<typeof api.getPublicShare>> | null;
  /** Blob URL for image preview — revoked on unmount. */
  previewBlobUrl: string | null;
};

type Props = { router: NextRouter };

class SharePage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { loading: true, error: null, data: null, previewBlobUrl: null };
  }

  componentDidMount() {
    void this.load();
  }

  componentDidUpdate(prev: Props) {
    if (prev.router.query.token !== this.props.router.query.token) {
      void this.load();
    }
  }

  componentWillUnmount() {
    const { previewBlobUrl } = this.state;
    if (previewBlobUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewBlobUrl);
    }
  }

  private tokenFromRouter(): string {
    const t = this.props.router.query.token;
    if (typeof t === "string") return t;
    if (Array.isArray(t)) return t[0] ?? "";
    return "";
  }

  private load = async () => {
    const token = this.tokenFromRouter();
    if (!token) return;
    const prevBlob = this.state.previewBlobUrl;
    if (prevBlob?.startsWith("blob:")) {
      URL.revokeObjectURL(prevBlob);
    }
    this.setState({ loading: true, error: null, previewBlobUrl: null });
    try {
      const data = await api.getPublicShare(token);
      let previewBlobUrl: string | null = null;
      if (
        data.item.item_type === "file" &&
        (data.item.mime_type || "").toLowerCase().startsWith("image/")
      ) {
        const blob = await api.fetchPublicShareFileBlob(token);
        previewBlobUrl = URL.createObjectURL(blob);
      }
      this.setState({ loading: false, data, error: null, previewBlobUrl });
    } catch (e: unknown) {
      this.setState({
        loading: false,
        error: String((e as Error).message ?? "Not found"),
        data: null,
        previewBlobUrl: null,
      });
    }
  };

  private downloadFile = async () => {
    const token = this.tokenFromRouter();
    const name = this.state.data?.item.name ?? "download";
    if (!token || this.state.data?.item.item_type !== "file") return;
    try {
      const blob = await api.fetchPublicShareFileBlob(token);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      /* ignore */
    }
  };

  render() {
    const { loading, error, data, previewBlobUrl } = this.state;
    const isImageFile =
      data?.item.item_type === "file" &&
      (data.item.mime_type || "").toLowerCase().startsWith("image/");
    return (
      <>
        <Head>
          <title>Shared item</title>
        </Head>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-6 w-6 text-muted-foreground" aria-hidden />
                Shared item
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : null}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {data ? (
                <div className="space-y-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {data.item.item_type === "folder" ? (
                      <Folder className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    ) : (
                      <File className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                    )}
                    <strong className="text-foreground">{data.item.name}</strong>
                    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs capitalize">
                      {data.item.item_type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <KeyRound className="h-3.5 w-3.5" aria-hidden />
                      {data.permission}
                    </span>
                  </p>
                  {data.item.item_type === "file" && isImageFile && previewBlobUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewBlobUrl}
                      alt={data.item.name}
                      className="max-h-[60vh] w-full rounded-md border object-contain"
                    />
                  ) : null}
                  {data.item.item_type === "file" && !isImageFile ? (
                    <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={this.downloadFile}>
                      Download file
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }
}

export default withRouter(SharePage);
