# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]: ⚡ Acme SaaS
  - main [ref=e4]:
    - generic [ref=e5]:
      - heading "Welcome back" [level=1] [ref=e6]
      - paragraph [ref=e7]: Sign in to your account
      - generic [ref=e8]:
        - generic [ref=e9]:
          - text: Email
          - textbox "Email" [ref=e10]:
            - /placeholder: you@example.com
        - generic [ref=e11]:
          - text: Password
          - textbox "Password" [ref=e12]:
            - /placeholder: ••••••••
        - generic [ref=e13]: Invalid email or password. Please try again.
        - button "Sign in" [ref=e14]
      - paragraph [ref=e15]:
        - text: Don't have an account?
        - link "Sign up" [ref=e16] [cursor=pointer]:
          - /url: "#"
```