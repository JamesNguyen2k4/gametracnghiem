async function requireAuthOrRedirect() {
    if (!window.supabaseClient) {
      console.error("Thiếu supabaseClient. Hãy nạp shared/supabase.js trước.");
      window.location.href = "../login/index.html";
      return null;
    }
  
    try {
      const {
        data: { session },
        error
      } = await window.supabaseClient.auth.getSession();
  
      if (error) {
        throw error;
      }
  
      if (!session?.user) {
        window.location.href = "../login/index.html";
        return null;
      }
  
      window.currentUser = session.user;
      window.currentSession = session;
      return session.user;
    } catch (error) {
      console.error("Auth guard error:", error);
      window.location.href = "../login/index.html";
      return null;
    }
  }
  
  async function logoutAndRedirect() {
    try {
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.href = "../login/index.html";
    }
  }