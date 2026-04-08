mixin (
  adminToken : ?Text,
  adminPassword : ?Text
) {
  public query func hasAdminCredentials() : async Bool {
    switch (adminToken, adminPassword) {
      case (?_, ?_) { true };
      case _ { false };
    };
  };

  public shared func setAdminCredentials(token : Text, password : Text) : async Bool {
    switch (adminToken) {
      case (?_) { false };
      case null {
        adminToken := ?token;
        adminPassword := ?password;
        true;
      };
    };
  };

  public shared func verifyAdminCredentials(token : Text, password : Text) : async Bool {
    switch (adminToken, adminPassword) {
      case (?t, ?p) { t == token and p == password };
      case _ { false };
    };
  };

  public shared func changeAdminCredentials(oldToken : Text, oldPassword : Text, newToken : Text, newPassword : Text) : async Bool {
    switch (adminToken, adminPassword) {
      case (?t, ?p) {
        if (t == oldToken and p == oldPassword) {
          adminToken := ?newToken;
          adminPassword := ?newPassword;
          true;
        } else { false };
      };
      case _ { false };
    };
  };
};
