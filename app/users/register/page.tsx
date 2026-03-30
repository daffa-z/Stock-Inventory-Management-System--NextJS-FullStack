"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";

type RoleType = "USER" | "ADMIN" | "DEV";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<RoleType>("USER");
  const [lokasi, setLokasi] = useState("PUSAT");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const isDev = (user?.role || "USER").toUpperCase() === "DEV";

  useEffect(() => {
    if (user && !isDev) {
      toast({
        title: "Akses ditolak",
        description: "Halaman pendaftaran pengguna hanya untuk role DEV.",
        variant: "destructive",
      });
      router.replace("/users");
    }
  }, [isDev, router, toast, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDev) {
      toast({
        title: "Akses ditolak",
        description: "Hanya role DEV yang dapat membuat pengguna baru.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Registration Failed",
        description: "Password and Confirm Password must match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await axiosInstance.post("/auth/register", {
        name,
        email,
        password,
        role,
        lokasi,
      });

      if (response.status === 201) {
        toast({
          title: "Account Created Successfully!",
          description: "Pengguna baru berhasil dibuat.",
        });

        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
        setRole("USER");
        setLokasi("PUSAT");

        setTimeout(() => {
          router.push("/users");
        }, 800);
      } else {
        throw new Error("Registration failed");
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error?.response?.data?.error || error?.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="flex justify-center items-center py-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md p-8 space-y-4 border rounded-lg">
          <h2 className="text-2xl font-bold">Buat Pengguna Baru</h2>
          <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input type="text" value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Lokasi (contoh: CABANG-A)" required />

          <select
            value={role}
            onChange={(e) => setRole((e.target.value === "ADMIN" ? "ADMIN" : e.target.value === "DEV" ? "DEV" : "USER") as RoleType)}
            className="w-full h-10 rounded-md border bg-background px-3"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="DEV">DEV</option>
          </select>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/users")}>Kembali</Button>
            <Button type="submit" className="w-full" disabled={isLoading || !isDev}>
              {isLoading ? "Creating Account..." : "Register"}
            </Button>
          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  );
}
