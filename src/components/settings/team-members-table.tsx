"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { changeTeamMemberRole, deactivateTeamMember, inviteTeamMember, reactivateTeamMember } from "@/lib/actions/team-members";
import { initialsFor, USER_ROLE_LABELS, type UserRole } from "@/lib/types";

const ROLES = Object.keys(USER_ROLE_LABELS) as UserRole[];

type Member = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  invited_at: string | null;
  created_at: string;
  user: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
};

function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("rep");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await inviteTeamMember(email.trim(), role);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      setRole("rep");
      setError(null);
      setOpen(false);
      toast.success(result.addedExisting ? "Added -- they already had an account, so no invite email was sent." : "Invite sent");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Invite member</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They&apos;ll get an email to set their password and join this organization.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)} items={ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button size="sm" disabled={isPending || !email.trim()} onClick={handleInvite}>
            {isPending ? "Inviting..." : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamMembersTable({ members, currentUserId, canManage }: { members: Member[]; currentUserId: string; canManage: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {canManage ? (
        <div className="flex justify-end">
          <InviteMemberDialog />
        </div>
      ) : null}
      <ul className="flex flex-col divide-y">
        {members.map((member) => {
          const name = member.user?.full_name ?? member.user?.email ?? "Unknown";
          const isSelf = member.user_id === currentUserId;
          return (
            <li key={member.id} className="flex items-center gap-3 py-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initialsFor(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {name} {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                </p>
                {member.user?.email ? <p className="text-xs text-muted-foreground">{member.user.email}</p> : null}
              </div>

              {member.status === "deactivated" ? <Badge variant="destructive">Deactivated</Badge> : null}
              {member.invited_at && member.status === "active" ? (
                <Badge variant="outline">Invited {formatDistanceToNow(new Date(member.invited_at), { addSuffix: true })}</Badge>
              ) : null}

              {canManage && !isSelf ? (
                <Select
                  value={member.role}
                  onValueChange={(v) => v && startTransition(() => changeTeamMemberRole(member.user_id, v as UserRole))}
                  items={ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))}
                >
                  <SelectTrigger size="sm" disabled={isPending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {USER_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="capitalize">
                  {USER_ROLE_LABELS[member.role as UserRole] ?? member.role}
                </Badge>
              )}

              {canManage && !isSelf ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      member.status === "deactivated" ? reactivateTeamMember(member.user_id) : deactivateTeamMember(member.user_id),
                    )
                  }
                >
                  {member.status === "deactivated" ? "Reactivate" : "Deactivate"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
