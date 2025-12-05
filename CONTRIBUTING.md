# Contributing to FormLab

Thank you for your interest in contributing to FormLab! We welcome contributions from the community to help make this project better.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/formlab-ugc-app.git
    cd formlab-ugc-app
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    cd functions && npm install && cd ..
    ```
4.  **Set up environment**:
    - Copy `.env.example` to `.env.local` and fill in your Firebase credentials.
    - Set up a Firebase project and enable Authentication, Firestore, and Storage.

## Development Workflow

1.  Create a new branch for your feature or fix:
    ```bash
    git checkout -b feature/amazing-feature
    ```
2.  Make your changes.
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Commit your changes using conventional commits (e.g., `feat: add new filter`, `fix: resolve crash on login`).

## Pull Request Process

1.  Push your branch to GitHub.
2.  Open a Pull Request against the `main` branch.
3.  Provide a clear description of the changes and link to any relevant issues.
4.  Ensure all checks pass and request a review.

## Code Style

- We use **TypeScript** for type safety.
- We follow **ESLint** and **Prettier** configurations (if available).
- Components should be functional and use hooks.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
