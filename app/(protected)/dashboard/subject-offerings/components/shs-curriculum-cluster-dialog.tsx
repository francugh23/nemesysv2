"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useArchiveShsCurriculumCluster,
  useCreateShsCurriculumCluster,
  useShsCurriculumClusters,
  useUpdateShsCurriculumCluster,
} from "@/hooks/subject-offering.hook";
import { CreateShsCurriculumClusterSchema } from "@/schemas";

type Cluster = NonNullable<ReturnType<typeof useShsCurriculumClusters>["data"]>[number];
type ClusterValues = z.infer<typeof CreateShsCurriculumClusterSchema>;

function ClusterForm({ cluster, onSuccess }: { cluster?: Cluster; onSuccess: () => void }) {
  const createCluster = useCreateShsCurriculumCluster();
  const updateCluster = useUpdateShsCurriculumCluster();
  const form = useForm<ClusterValues>({
    resolver: zodResolver(CreateShsCurriculumClusterSchema),
    defaultValues: cluster ?? { code: "", name: "", track: "ACADEMIC" },
  });
  const mutation = cluster ? updateCluster : createCluster;

  async function submit(values: ClusterValues) {
    const result = cluster
      ? await updateCluster.mutateAsync({ id: cluster.id, values })
      : await createCluster.mutateAsync(values);
    if (!("success" in result)) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success);
    onSuccess();
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end">
      <Field>
        <FieldLabel>Code</FieldLabel>
        <Input {...form.register("code")} placeholder="STEM" />
        <FieldError>{form.formState.errors.code?.message}</FieldError>
      </Field>
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input {...form.register("name")} placeholder="Science, Technology, Engineering, and Mathematics" />
        <FieldError>{form.formState.errors.name?.message}</FieldError>
      </Field>
      <Field>
        <FieldLabel>Track</FieldLabel>
        <Controller name="track" control={form.control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ACADEMIC">Academic</SelectItem><SelectItem value="TECHPRO">TechPro</SelectItem></SelectContent>
          </Select>
        )} />
      </Field>
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : cluster ? "Update" : "Add Cluster"}</Button>
    </form>
  );
}

export function ShsCurriculumClusterDialog() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cluster | null>(null);
  const { data: clusters = [], isLoading } = useShsCurriculumClusters();
  const archiveCluster = useArchiveShsCurriculumCluster();

  async function archive(id: string) {
    const result = await archiveCluster.mutateAsync(id);
    if (!("success" in result)) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Settings2 />Manage SSHS Clusters</Button>
      <FormDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }} title="SHS Curriculum Clusters" maxWidth="max-w-5xl!">
        <p className="text-sm text-muted-foreground">Create only clusters the school is prepared to configure. This does not import DepEd curriculum or create offerings.</p>
        <ClusterForm key={editing?.id ?? "new"} cluster={editing ?? undefined} onSuccess={() => setEditing(null)} />
        <div className="space-y-2">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading clusters...</p> : clusters.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No SHS curriculum clusters configured.</p> : clusters.map((cluster) => (
            <div key={cluster.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div><p className="font-medium">{cluster.name}</p><p className="text-sm text-muted-foreground">{cluster.code} · {cluster.track === "ACADEMIC" ? "Academic" : "TechPro"}</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(cluster)}>Edit</Button><Button variant="outline" size="sm" className="text-destructive" disabled={archiveCluster.isPending} onClick={() => void archive(cluster.id)}>Archive</Button></div>
            </div>
          ))}
        </div>
      </FormDialog>
    </>
  );
}
