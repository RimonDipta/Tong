import { ArrowLeft, Camera, Loader2, LogOut, Save } from "lucide-react";

import { useRef, useState, type ChangeEvent } from "react";

import { useNavigate } from "react-router-dom";

import Avatar from "../components/ui/Avatar";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import api, { getErrorMessage } from "../lib/api";

export default function Profile() {
  const navigate = useNavigate();

  const { user, updateUser, logout } = useAuth();

  const toast = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(user?.name || "");

  const [username, setUsername] = useState(user?.username || "");

  const [bio, setBio] = useState(user?.bio || "");

  const [avatar, setAvatar] = useState(user?.avatar || "");

  const [saving, setSaving] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [error, setError] = useState("");

  const dirty =
    name.trim() !== (user?.name || "") ||
    username !== (user?.username || "") ||
    bio.trim() !== (user?.bio || "");

  async function handleSaveProfile() {
    setError("");

    try {
      setSaving(true);

      const response = await api.patch("/users/me", {
        name,
        username,
        bio,
      });

      const updatedUser = response.data.user;

      updateUser(updatedUser);

      setName(updatedUser.name || "");
      setUsername(updatedUser.username || "");
      setBio(updatedUser.bio || "");
      setAvatar(updatedUser.avatar || "");

      toast.success("Profile saved");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");

      event.target.value = "";

      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Avatar cannot exceed 10 MB.");

      event.target.value = "";

      return;
    }

    try {
      setUploadingAvatar(true);

      const formData = new FormData();

      formData.append("avatar", file);

      const response = await api.post("/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const newAvatar = response.data.avatar;

      setAvatar(newAvatar);

      /*
       * Keep the global authenticated
       * user synchronized with the
       * uploaded avatar.
       */
      if (user) {
        updateUser({
          ...user,
          avatar: newAvatar,
        });
      }

      toast.success("Photo updated");
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Couldn't upload your photo."));
    } finally {
      setUploadingAvatar(false);

      event.target.value = "";
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-zinc-100">
      <header className="flex h-16 items-center border-b border-zinc-800/80 bg-[var(--surface)] px-4">
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          aria-label="Back to chat"
        >
          <ArrowLeft size={18} />
        </button>

        <div>
          <h1 className="text-sm font-medium text-zinc-200">Profile</h1>

          <p className="text-[11px] text-zinc-600">Manage your account</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-[var(--surface)]">
          <div className="border-b border-zinc-800/80 px-6 py-8">
            <div className="flex flex-col items-center">
              <div className="relative">
                <Avatar name={name} src={avatar} size="xl" />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-100 text-zinc-900 shadow-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Change avatar"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Camera size={16} />
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <h2 className="mt-4 text-lg font-semibold text-zinc-100">
                {name || "Your name"}
              </h2>

              <p className="mt-1 text-sm text-zinc-600">
                @{username || "username"}
              </p>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div>
              <label
                htmlFor="profile-name"
                className="mb-2 block text-xs font-medium text-zinc-400"
              >
                Name
              </label>

              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={50}
                className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="profile-username"
                className="mb-2 block text-xs font-medium text-zinc-400"
              >
                Username
              </label>

              <div className="flex h-11 items-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 focus-within:border-zinc-600">
                <span className="text-sm text-zinc-600">@</span>

                <input
                  id="profile-username"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .replace(/[^a-zA-Z0-9_]/g, "")
                        .toLowerCase(),
                    )
                  }
                  maxLength={30}
                  className="min-w-0 flex-1 bg-transparent pl-1 text-sm text-zinc-200 outline-none"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-email"
                className="mb-2 block text-xs font-medium text-zinc-400"
              >
                Email
              </label>

              <input
                id="profile-email"
                value={user?.email || ""}
                disabled
                className="h-11 w-full cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-600 outline-none"
              />

              <p className="mt-1.5 text-[10px] text-zinc-700">
                Email cannot be changed here.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="profile-bio"
                  className="text-xs font-medium text-zinc-400"
                >
                  Bio
                </label>

                <span className="text-[10px] text-zinc-700">
                  {bio.length}/160
                </span>
              </div>

              <textarea
                id="profile-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={160}
                rows={4}
                className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                placeholder="Tell people a little about yourself..."
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving || !dirty}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {dirty ? "Save changes" : "Saved"}
                </>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800/80 py-3 text-sm font-medium text-red-400 transition hover:bg-red-950/20"
        >
          <LogOut size={16} />
          Log out
        </button>
      </main>
    </div>
  );
}
