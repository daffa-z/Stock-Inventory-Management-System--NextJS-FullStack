export type ClientSessionUser = {
  id: string;
  name?: string;
  email: string;
  role?: string;
  lokasi?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const getSessionClient = async (): Promise<ClientSessionUser | null> => {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return user;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in getSessionClient:", error);
    }
    return null;
  }
};
