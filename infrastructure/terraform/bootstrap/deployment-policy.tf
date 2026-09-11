# CI may mutate application resources, never its own identity, boundary or bootstrap state.
resource "aws_iam_role_policy" "deployment" {
  name = "terraform-demo-deployment"
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "RegistryLogin", Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = ["*"] },
      {
        Sid      = "PublishImages", Effect = "Allow"
        Action   = ["ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetRepositoryPolicy", "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
        Resource = [for repo in aws_ecr_repository.images : repo.arn]
      },
      {
        Sid       = "StateList", Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.state.arn]
        Condition = { StringLike = { "s3:prefix" = ["demo/terraform.tfstate", "demo/terraform.tfstate.tflock", "env:/"] } }
      },
      { Sid = "StateReadWrite", Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = ["${aws_s3_bucket.state.arn}/demo/terraform.tfstate"] },
      { Sid = "StateLock", Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.state.arn}/demo/terraform.tfstate.tflock"] },
      {
        Sid      = "Functions", Effect = "Allow"
        Action   = ["lambda:CreateFunction", "lambda:DeleteFunction", "lambda:GetFunction", "lambda:GetFunctionConfiguration", "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration", "lambda:AddPermission", "lambda:RemovePermission", "lambda:GetPolicy", "lambda:TagResource", "lambda:UntagResource", "lambda:ListTags", "lambda:ListVersionsByFunction", "lambda:GetFunctionCodeSigningConfig", "lambda:GetRuntimeManagementConfig", "lambda:PutFunctionConcurrency", "lambda:DeleteFunctionConcurrency", "lambda:GetFunctionConcurrency"]
        Resource = local.function_arns
      },
      {
        Sid      = "UploadBucketConfiguration", Effect = "Allow"
        Action   = ["s3:CreateBucket", "s3:DeleteBucket", "s3:GetBucketLocation", "s3:ListBucket", "s3:GetBucketPolicy", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy", "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock", "s3:GetEncryptionConfiguration", "s3:PutEncryptionConfiguration", "s3:GetLifecycleConfiguration", "s3:PutLifecycleConfiguration", "s3:GetBucketCORS", "s3:PutBucketCORS", "s3:GetBucketTagging", "s3:PutBucketTagging", "s3:GetBucketVersioning", "s3:GetBucketAcl", "s3:GetBucketLogging", "s3:GetBucketWebsite", "s3:GetReplicationConfiguration", "s3:GetBucketRequestPayment", "s3:GetAccelerateConfiguration", "s3:GetBucketObjectLockConfiguration", "s3:GetBucketOwnershipControls", "s3:PutBucketOwnershipControls"]
        Resource = [local.bucket_arn]
      },
      {
        Sid      = "RuntimeLogs", Effect = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:DeleteLogGroup", "logs:PutRetentionPolicy", "logs:DeleteRetentionPolicy", "logs:TagResource", "logs:UntagResource", "logs:ListTagsForResource", "logs:ListTagsLogGroup"]
        Resource = concat(local.log_arns, [for arn in local.log_arns : "${arn}:*"])
      },
      # DescribeLogGroups does not support resource-level authorization.
      { Sid = "DescribeLogs", Effect = "Allow", Action = ["logs:DescribeLogGroups"], Resource = ["*"] },
      # API IDs are assigned by AWS: this is the documented regional scope exception.
      {
        Sid      = "RegionalHttpApis", Effect = "Allow"
        Action   = ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE", "apigateway:TagResource", "apigateway:UntagResource"]
        Resource = ["arn:aws:apigateway:${var.region}::/apis", "arn:aws:apigateway:${var.region}::/apis/*", "arn:aws:apigateway:${var.region}::/tags/*"]
      },
      {
        Sid       = "BoundedRoleCreation", Effect = "Allow", Action = ["iam:CreateRole", "iam:PutRolePermissionsBoundary"], Resource = local.runtime_arns
        Condition = { StringEquals = { "iam:PermissionsBoundary" = aws_iam_policy.runtime_boundary.arn } }
      },
      # Deliberately without iam:UpdateAssumeRolePolicy: IAM has no condition key
      # for the contents of a trust policy, so the action cannot be scoped, and a
      # holder would rewrite a runtime role to trust this one and then assume it
      # outright. modules/demo writes each trust policy at iam:CreateRole and
      # never changes it, so only drift correction would need it; an operator
      # repairs that by hand rather than leave the path open.
      {
        Sid      = "RuntimeRoleConfiguration", Effect = "Allow"
        Action   = ["iam:GetRole", "iam:DeleteRole", "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole", "iam:TagRole", "iam:UntagRole"]
        Resource = local.runtime_arns
      },
      {
        Sid       = "PassOnlyRuntimeRolesToLambda", Effect = "Allow", Action = ["iam:PassRole"], Resource = local.runtime_arns
        Condition = { StringEquals = { "iam:PassedToService" = "lambda.amazonaws.com" } }
      }
    ]
  })
}
