# Git Setup Instructions

This document provides step-by-step instructions for initializing a Git repository and pushing the 2025 Global Workforce Survey AI Assistant project to GitHub or other Git providers.

## Prerequisites

Before proceeding, ensure you have:

1. Git installed on your system (check with `git --version`)
2. A GitHub, GitLab, or Bitbucket account
3. Proper Git authentication set up (SSH keys or token)

## Step 1: Initialize a Git Repository

Navigate to the root of the "2025 build" directory and run:

```bash
# Navigate to the project directory
cd "2025 build"

# Initialize a new Git repository
git init
```

## Step 2: Add Files to Git

Add the project files to the staging area:

```bash
# Add all files to staging
git add .

# Alternatively, add specific files/directories
# git add package.json vercel.json next.config.js etc.
```

## Step 3: Create Initial Commit

Create your first commit:

```bash
git commit -m "Initial commit: 2025 Global Workforce Survey AI Assistant"
```

## Step 4: Create a Remote Repository

### GitHub

1. Go to [GitHub](https://github.com) and log in
2. Click the "+" icon in the top-right corner and select "New repository"
3. Name your repository (e.g., "workforce-survey-2025")
4. Choose public or private visibility
5. Do not initialize with README, .gitignore, or license
6. Click "Create repository"

### GitLab/Bitbucket

Follow similar steps on your chosen platform to create an empty repository.

## Step 5: Link Remote Repository

Connect your local repository to the remote:

```bash
# Replace the URL with your actual repository URL
git remote add origin https://github.com/yourusername/workforce-survey-2025.git

# Or if using SSH:
# git remote add origin git@github.com:yourusername/workforce-survey-2025.git
```

## Step 6: Push to Remote Repository

Push your code to the remote repository:

```bash
# Push to the main branch (default branch)
git push -u origin main

# If your default branch is 'master' instead:
# git push -u origin master
```

## Best Practices

1. **Protect Sensitive Information**: Ensure the `.gitignore` file is properly set up to exclude sensitive files like `.env.local`.

2. **Regular Commits**: Make frequent, atomic commits with descriptive messages.

3. **Consider Branching Strategy**: For larger teams, consider using feature branches and pull requests.

4. **README Updates**: Keep the main README.md file updated with setup instructions and project information.

5. **Version Tagging**: Use Git tags to mark significant versions or releases.

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

```bash
# Check your remote URL
git remote -v

# Update remote if needed
git remote set-url origin https://github.com/yourusername/workforce-survey-2025.git

# Use token authentication if needed
git remote set-url origin https://yourusername:your-token@github.com/yourusername/workforce-survey-2025.git
```

### Large File Issues

If you have large files:

- Consider using Git LFS (Large File Storage)
- Or exclude large files in the `.gitignore` file

### Default Branch Name Issues

If your default branch name differs:

```bash
# Check your current branch
git branch

# Rename your branch if needed
git branch -m main
```

## Additional Resources

- [GitHub Documentation](https://docs.github.com/en)
- [GitLab Documentation](https://docs.gitlab.com)
- [Git Documentation](https://git-scm.com/doc)
