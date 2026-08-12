"use client";

import { Braces, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { designSpecSchema } from "@/lib/contracts";
import type { DesignSpec } from "@/types/site";

interface DesignSpecReviewProps {
  edited?: boolean;
  onReviewed: (spec: DesignSpec) => void;
  spec: DesignSpec;
}

export function DesignSpecReview({ edited = false, onReviewed, spec }: DesignSpecReviewProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(spec, null, 2));
  const [error, setError] = useState("");

  function showEditor() {
    setDraft(JSON.stringify(spec, null, 2));
    setError("");
    setOpen(true);
  }

  function saveDraft() {
    let value: unknown;
    try {
      value = JSON.parse(draft);
    } catch {
      setError("DesignSpec 不是有效的 JSON。");
      return;
    }
    const parsed = designSpecSchema.safeParse(value);
    if (!parsed.success) {
      setError("DesignSpec 格式无效，请检查必填字段、版本和证据置信度。");
      return;
    }
    onReviewed(parsed.data);
    setOpen(false);
  }

  return (
    <>
      <Button className="w-full" onClick={showEditor} variant="outline">
        {edited ? <Check aria-hidden="true" /> : <Braces aria-hidden="true" />}
        {edited ? "设计规范已人工修订" : "编辑设计规范"}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑 DesignSpec JSON</DialogTitle>
            <DialogDescription>保存前会按 DesignSpec 1.0 契约校验。DesignSpec 用于解释设计规律，不会修改已经编译和验证的 Remix 代码产物。</DialogDescription>
          </DialogHeader>
          <Textarea
            aria-invalid={Boolean(error)}
            aria-label="DesignSpec JSON"
            className="max-h-[58svh] min-h-80 resize-y font-mono text-xs leading-5"
            onChange={(event) => { setDraft(event.target.value); setError(""); }}
            spellCheck={false}
            value={draft}
          />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">取消</Button>
            <Button onClick={saveDraft}>保存设计规范修订</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
